# frozen_string_literal: true

require 'json'
raise 'Only the isolated beta database may be probed' unless ActiveRecord::Base.connection_db_config.database == 'mastodon_beta' && ENV['NOFAN_SNAPSHOT_MODE'] == 'true'

result = {}
ActiveRecord::Base.transaction do
  ActiveRecord::Base.connection.execute('SET TRANSACTION READ ONLY')
  result[:user_count] = User.count
  keys = Keypair.joins(:account).where(accounts: { domain: nil }, revoked: false).where.not(private_key: nil)
  result[:local_keypairs_decryptable] = keys.all? { |k| k.private_key.present? && OpenSSL::PKey.read(k.private_key).private? }
  result[:local_keypair_count] = keys.count
  user = User.where(otp_required_for_login: true)
  result[:totp_secrets_decryptable] = user.all? { |u| u.otp_secret.present? }
  result[:totp_users] = user.count
  result[:legacy_private_key_column] = Account.column_names.include?('private_key')
  begin
    Account.new(username: 'shared_schema_probe').send(:generate_keys)
    result[:new_local_account_key_generation] = 'compatible'
  rescue NameError => e
    result[:new_local_account_key_generation] = e.class.name
  end
  begin
    Fasp::Provider.with_capability('discovery').limit(1).load
    result[:fasp_capability_query] = 'compatible'
  rescue ActiveRecord::StatementInvalid => e
    result[:fasp_capability_query] = e.cause.class.name
    # A failed SQL statement aborts PostgreSQL's read-only transaction; no further SQL.
  end
  raise ActiveRecord::Rollback
end
payload = '{"web.theme_color":"indigo","display_own_posts":false,"future_probe_key":"kept"}'
loaded = UserSettingsSerializer.load(payload)
result[:unknown_preference_keys_preserved] = JSON.parse(UserSettingsSerializer.dump(loaded)) == JSON.parse(payload)
begin
  loaded['web.theme_color']
  result[:new_preference_key_access] = 'compatible'
rescue UserSettings::KeyError => e
  result[:new_preference_key_access] = e.class.name
end
result[:new_feed_worker_defined] = Object.const_defined?(:MultiMergeIntoOwnHomeWorker)
result[:new_reach_worker_defined] = Object.const_defined?(:UpdateAccountReachWorker)
result[:setting_cache_prefix] = Setting.cache_prefix_by_startup
puts JSON.generate(result)
