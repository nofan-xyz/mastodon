# frozen_string_literal: true

require 'json'
raise 'Wrong database' unless ActiveRecord::Base.connection_db_config.database == 'mastodon_beta'
raise 'Isolation not active' unless ENV['NOFAN_SNAPSHOT_MODE'] == 'true'

Setting.registrations_mode = 'none'
Setting.noindex = true
Rails.cache.clear
result = { users: User.count, local_accounts: Account.local.count, statuses: Status.count, media_attachments: MediaAttachment.count, site_title: Setting.site_title, local_domain: Rails.configuration.x.local_domain, web_domain: Rails.configuration.x.web_domain, oauth_tokens: Doorkeeper::AccessToken.count,
           push_subscriptions: Web::PushSubscription.count, sessions: SessionActivation.count }
# Do not expose account identifiers, password hashes, TOTP secrets or tokens.
result[:passwords_and_settings_digest] = ActiveRecord::Base.connection.select_value("SELECT md5(string_agg(id::text || ':' || encrypted_password || ':' || COALESCE(settings::text,''), '|' ORDER BY id)) FROM users")
otp = User.where(otp_required_for_login: true)
result[:two_factor_users] = otp.count
result[:two_factor_decryption_ok] = otp.all? { |u| u.otp_secret.present? }
raise 'Copied 2FA encryption could not be read' unless result[:two_factor_decryption_ok]

puts "SNAPSHOT_RESULT=#{JSON.generate(result)}"
