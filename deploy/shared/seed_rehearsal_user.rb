# frozen_string_literal: true

require 'json'
require 'securerandom'

raise 'Wrong rehearsal target' unless ENV['NOFAN_REHEARSAL'] == 'true' && ActiveRecord::Base.connection_db_config.database == 'mastodon_shared_rehearsal'

role = ARGV.fetch(0)
raise 'Unknown fixture role' unless %w(a b c).include?(role)

path = '/results/users.json'
fixtures = File.exist?(path) ? JSON.parse(File.read(path)) : {}
if fixtures.key?(role)
  puts JSON.generate(fixture_already_created: role)
  exit
end

username = "shared#{role}_#{SecureRandom.hex(5)}"
password = SecureRandom.hex(24)
user = User.new(email: "#{username}@example.invalid", password:, account: Account.new(username:, display_name: "Shared rehearsal #{role}"))
user.skip_confirmation!
user.save!(validate: false)
user.update_columns(approved: true, disabled: false, require_tos_interstitial: false, age_verified_at: Time.current, current_sign_in_at: Time.current, sign_in_count: 1)

secret = nil
if role != 'a'
  secret = ROTP::Base32.random
  user.otp_secret = secret
  user.otp_required_for_login = true
  user.save!(validate: false)
end
user.update_columns(role_id: UserRole.order(position: :desc).first!.id) if role == 'c'

policy = NotificationPolicy.find_or_initialize_by(account_id: user.account_id)
policy.attributes = policy.class.column_names.grep(/\Afilter_/).index_with(false)
policy.save!

token = Doorkeeper::AccessToken.create!(resource_owner_id: user.id, scopes: 'read write follow push')
fixtures[role] = { 'user_id' => user.id.to_s, 'account_id' => user.account_id.to_s, 'username' => username, 'email' => user.email, 'password' => password, 'token' => token.token, 'otp_secret' => secret }
File.write(path, JSON.pretty_generate(fixtures), perm: 0o600)
puts JSON.generate(fixture_created: role, application_version: Mastodon::Version.to_s)
