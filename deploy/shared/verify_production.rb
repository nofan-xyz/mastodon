# frozen_string_literal: true

require 'json'
require 'net/http'
require 'uri'
require 'sidekiq/api'
raise 'Wrong live target' unless ENV['NOFAN_SHARED_DATA'] == 'true' && ENV['NOFAN_REHEARSAL'] != 'true' && ActiveRecord::Base.connection_db_config.database == 'mastodon_production' && ENV['S3_BUCKET'] == 'nofan-box'

nodes = { 'legacy' => ['web', 'nofan.xyz'], 'beta' => ['web-beta', 'beta.nofan.xyz'] }
def get(node, path, token = nil)
  hostname, host = node
  request = Net::HTTP::Get.new(path)
  request['Host'] = host
  request['X-Forwarded-Proto'] = 'https'
  request['Authorization'] = "Bearer #{token}" if token
  response = Net::HTTP.start(hostname, 3000, open_timeout: 5, read_timeout: 20) { |http| http.request(request) }
  [response.code.to_i, response.body]
end

nodes.each_value do |node|
  code, body = get(node, '/api/v2/instance')
  raise 'Instance readback failed' unless code == 200 && JSON.parse(body)['domain'] == 'nofan.xyz'
end
puts 'PASS both live Webs advertise canonical nofan.xyz identity'

token = Doorkeeper::AccessToken.where(revoked_at: nil).where("scopes LIKE '%read%'").order(created_at: :desc).limit(200).detect do |candidate|
  next false if candidate.expired?

  user = User.find_by(id: candidate.resource_owner_id)
  next false unless user&.active_for_authentication?

  nodes.all? { |_name, node| get(node, '/api/v1/accounts/verify_credentials', candidate.token).first == 200 }
end
raise 'No existing readable OAuth token available for live authenticated readback' unless token

responses = nodes.transform_values { |node| JSON.parse(get(node, '/api/v1/accounts/verify_credentials', token.token).last) }
keys = %w(id username acct display_name note locked bot discoverable fields)
raise 'Live profiles differ' unless responses['legacy'].slice(*keys) == responses['beta'].slice(*keys)
raise 'Unexpected account identity' unless URI(responses['beta']['url']).host == 'nofan.xyz'

puts 'PASS one existing production OAuth identity reads the same profile on both Webs'

prefs = nodes.transform_values do |node|
  code, body = get(node, '/api/v1/preferences', token.token)
  raise 'Preferences readback failed' unless code == 200

  JSON.parse(body)
end
shared_keys = prefs['legacy'].keys & prefs['beta'].keys
raise 'Live preferences differ' unless shared_keys.all? { |key| prefs['legacy'][key] == prefs['beta'][key] }

puts 'PASS common account preference values agree across the live versions'

nodes.each_value do |node|
  %w(/api/v1/timelines/home?limit=3 /api/v1/notifications?limit=3).each do |path|
    code, body = get(node, path, token.token)
    raise 'Authenticated feed/notification readback failed' unless code == 200 && JSON.parse(body).is_a?(Array)
  end
end
puts 'PASS authenticated home timelines and notifications readable on both Webs'

require 'openssl'
local_keys = Keypair.joins(:account).where(accounts: { domain: nil })
raise 'Cannot decrypt a shared local signing key' unless local_keys.all? { |key| key.private_key.present? }
raise 'Cannot decrypt a shared TOTP secret' unless User.where(otp_required_for_login: true).all? { |user| user.otp_secret.present? }

puts 'PASS existing local signing keys and enabled TOTP secrets remain decryptable'

raise 'Wrong WebAuthn RP' unless WebAuthn.configuration.rp_id == 'nofan.xyz'
raise 'Missing beta WebAuthn origin' unless WebAuthn.configuration.allowed_origins.include?('https://beta.nofan.xyz')

puts 'PASS canonical WebAuthn RP and explicit beta origin'
puts JSON.generate(worker_processes: Sidekiq::ProcessSet.new.size, retry_jobs: Sidekiq::RetrySet.new.size, dead_jobs: Sidekiq::DeadSet.new.size, queues: Sidekiq::Queue.all.to_h { |queue| [queue.name, queue.size] })
