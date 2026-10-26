# frozen_string_literal: true

raise 'Wrong rollback probe target' unless ActiveRecord::Base.connection_db_config.database == 'mastodon_shared_rehearsal'
raise 'Expected unmodified original legacy image' unless ENV['SOURCE_COMMIT'] == '0afb546c7d8139688642c80c1cc14d6e17335317'

ActiveRecord::Base.transaction do
  ActiveRecord::Base.connection.execute('SET TRANSACTION READ ONLY')
  raise 'Old private key field missing' unless Account.column_names.include?('private_key')

  local_keys = Keypair.joins(:account).where(accounts: { domain: nil }).to_a
  raise 'Cannot decrypt original keys' unless local_keys.all? { |key| key.private_key.present? }

  users = User.where(otp_required_for_login: true).to_a
  raise 'Cannot decrypt original TOTP secrets' unless users.all? { |user| user.otp_secret.present? }
  raise 'Legacy FASP JSON is incompatible' unless Fasp::Provider.with_capability('discovery').first!.capability_enabled?('discovery')
  raise 'Unknown preferences lost' if User.find(JSON.parse(File.read('/results/users.json')).fetch('a').fetch('user_id')).settings.as_json.blank?

  puts JSON.generate(rollback_read_only: true, local_keys_readable: local_keys.size, totp_users_readable: users.size, legacy_fasp: true)
end
