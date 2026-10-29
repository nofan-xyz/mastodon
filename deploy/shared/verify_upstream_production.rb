# frozen_string_literal: true

require 'json'
require 'digest'

raise 'Wrong production target' unless ENV['NOFAN_SHARED_DATA'] == 'true' && ENV['NOFAN_REHEARSAL'] != 'true' && ActiveRecord::Base.connection_db_config.database == 'mastodon_production' && ENV['S3_BUCKET'] == 'nofan-box'
raise 'Wrong Ruby/image' unless RUBY_VERSION == '4.0.8' && ENV['SOURCE_COMMIT'] == 'b7bdcba68320de523bbd6c763129586f89926145'

connection = ActiveRecord::Base.connection
versions = connection.select_values('SELECT version FROM schema_migrations ORDER BY version')
files = ActiveRecord::Migrator.migrations_paths.flat_map { |folder| Dir[File.join(folder, '*.rb')] }
known_versions = files.filter_map { |file| File.basename(file)[/\A\d+/] }.uniq
pending = known_versions - versions
identity = {
  users: User.count,
  passwords: Digest::SHA256.hexdigest(User.order(:id).pluck(:id, :encrypted_password).to_json),
  keys: Digest::SHA256.hexdigest(connection.select_rows('SELECT k.id, k.private_key FROM keypairs k JOIN accounts a ON a.id = k.account_id WHERE a.domain IS NULL ORDER BY k.id').to_json),
  legacy_keys: Digest::SHA256.hexdigest(connection.select_rows('SELECT id, private_key FROM accounts WHERE private_key IS NOT NULL ORDER BY id').to_json),
}
if ARGV.fetch(0) == 'before'
  raise "Unexpected pending migrations: #{pending.join(',')}" unless pending == ['20261013133732']

  File.write('/release/identity-before.json', JSON.generate(identity:, versions:))
  puts 'PASS live preflight: only the rehearsed additive migration is pending'
else
  old = JSON.parse(File.read('/release/identity-before.json'))
  raise 'New migration not applied' unless pending.empty? && connection.table_exists?('admin_server_checks')
  raise 'Unexpected schema migration change' unless versions - old.fetch('versions') == ['20261013133732']
  raise 'Account identity changed during migration; inspect legitimate concurrent writes before proceeding' unless old.fetch('identity') == identity.stringify_keys

  File.write('/release/identity-after.json', JSON.generate(identity:, versions:))
  puts 'PASS live additive migration and unchanged passwords/local signing keys/legacy keys'
end
