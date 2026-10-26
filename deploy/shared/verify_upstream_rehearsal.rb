# frozen_string_literal: true

require 'json'
require 'digest'

raise 'Wrong rehearsal target' unless ENV['NOFAN_REHEARSAL'] == 'true' && ActiveRecord::Base.connection_db_config.database == 'mastodon_shared_rehearsal'

mode = ARGV.fetch(0)
path = '/results/upstream-20261027-identity.json'
connection = ActiveRecord::Base.connection
identity = {
  users: User.count,
  passwords: Digest::SHA256.hexdigest(User.order(:id).pluck(:id, :encrypted_password).to_json),
  keys: Digest::SHA256.hexdigest(connection.select_rows('SELECT id, private_key FROM keypairs ORDER BY id').to_json),
  legacy_keys: Digest::SHA256.hexdigest(connection.select_rows('SELECT id, private_key FROM accounts WHERE private_key IS NOT NULL ORDER BY id').to_json),
  legacy_fasp: Digest::SHA256.hexdigest(connection.select_rows('SELECT id, capabilities FROM fasp_providers ORDER BY id').to_json),
}
versions = connection.select_values('SELECT version FROM schema_migrations ORDER BY version')
if mode == 'before'
  File.write(path, JSON.generate(identity:, versions:))
  puts "PASS saved isolated pre-migration identity for #{identity[:users]} users"
elsif mode == 'after'
  old = JSON.parse(File.read(path))
  raise 'Migration changed account identity or legacy mirrors' unless old.fetch('identity') == identity.stringify_keys
  raise 'Unexpected migrations' unless versions - old.fetch('versions') == ['20261013133732']
  raise 'Missing health check table' unless connection.table_exists?('admin_server_checks')
  raise 'Wrong Ruby version' unless RUBY_VERSION == '4.0.8'
  raise 'Wrong image source' unless ENV['SOURCE_COMMIT'] == 'b7bdcba68320de523bbd6c763129586f89926145'

  puts 'PASS Ruby 4.0.8, source revision, additive migration and identity/legacy mirror invariants'
else
  raise 'Unknown probe mode'
end
