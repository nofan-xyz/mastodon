# frozen_string_literal: true

require 'json'
require 'warden/test/helpers'
require 'action_dispatch/testing/integration'

raise 'Wrong database' unless ActiveRecord::Base.connection_db_config.database == 'mastodon_beta'
raise 'Isolation not active' unless ENV['NOFAN_SNAPSHOT_MODE'] == 'true'

user = User.where(approved: true, disabled: false, require_tos_interstitial: false).where.not(confirmed_at: nil).joins(:account).where(accounts: { suspended_at: nil }).first!
session = ActionDispatch::Integration::Session.new(Rails.application)
session.host! 'beta.nofan.xyz'
session.https!
Warden.test_mode!
token = nil

begin
  # This exercises copied-account authorization without changing its password or
  # asking for/printing a production password. It is not a password-login test.
  Warden.on_next_request { |proxy| proxy.set_user(user, scope: :user) }
  session.get '/home'
  raise "Home returned #{session.response.status}" unless session.response.status == 200

  encoded = session.response.body[%r{<script[^>]*id=["']initial-state["'][^>]*>(.*?)</script>}m, 1]
  raise 'Missing application state' unless encoded

  state = JSON.parse(encoded)
  token = state.fetch('meta').fetch('access_token')
  headers = { 'Authorization' => "Bearer #{token}" }
  session.get '/api/v1/accounts/verify_credentials', headers: headers
  raise 'Copied-account API failed' unless session.response.status == 200 && JSON.parse(session.response.body).fetch('id') == user.account_id.to_s

  session.get '/api/v1/preferences', headers: headers
  raise 'Preferences API failed' unless session.response.status == 200

  session.get '/api/v1/timelines/home', headers: headers
  raise 'Home timeline failed' unless session.response.status == 200 && JSON.parse(session.response.body).is_a?(Array)

  puts JSON.generate(copied_account_authorization: 'passed', application_html: 'passed', account_api: 'passed', preferences_api: 'passed', timeline_api: 'passed', password_login: 'not exercised; passwords and settings checked by digest')
ensure
  Doorkeeper::AccessToken.find_by(token: token)&.destroy! if token
  Warden.test_reset!
end
