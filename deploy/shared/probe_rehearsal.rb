# frozen_string_literal: true

require 'json'
raise 'Wrong rehearsal target' unless ENV['NOFAN_REHEARSAL'] == 'true' && ActiveRecord::Base.connection_db_config.database == 'mastodon_shared_rehearsal'
fixtures = JSON.parse(File.read('/results/users.json'))
user = User.find(fixtures.fetch('a').fetch('user_id'))
mode = ARGV.fetch(0)
case mode
when 'stale'
  user.settings['web.reduce_motion'] = false
  user.save!
  stale = User.find(user.id)
  File.write('/results/prefs-loaded', 'ready')
  deadline = Time.current + 90
  sleep 0.1 until File.exist?('/results/prefs-written') || Time.current > deadline
  raise 'Other Web did not write preferences' unless File.exist?('/results/prefs-written')
  stale.settings['web.reduce_motion'] = true
  stale.save!
  raise 'Other version preference was overwritten' unless stale.reload.settings['web.theme_color'] == 'blue'
  puts 'PASS stale 4.7 preference save preserves a concurrent 5.0 preference'
when 'new-preference'
  deadline = Time.current + 90
  sleep 0.1 until File.exist?('/results/prefs-loaded') || Time.current > deadline
  raise 'Stale reader not ready' unless File.exist?('/results/prefs-loaded')
  user.settings['web.theme_color'] = 'blue'
  user.save!
  File.write('/results/prefs-written', 'ready')
when 'preferences-check'
  raise 'Concurrent preferences missing' unless user.settings['web.reduce_motion'] && user.settings['web.theme_color'] == 'blue'
  puts 'PASS both preference changes readable through 5.0'
when 'site-write'
  Setting.site_title = ARGV.fetch(1)
when 'site-check'
  raise 'Stale site setting' unless Setting.site_title == ARGV.fetch(1)
  puts 'PASS shared site setting readable from ' + Mastodon::Version.to_s
when 'fasp-create'
  raise 'Unexpected existing provider' if Fasp::Provider.exists?
  provider = Fasp::Provider.create!(name: 'Isolated rehearsal', base_url: 'https://provider.example.invalid', remote_identifier: 'fixture', provider_public_key_pem: OpenSSL::PKey.generate_key('ED25519').public_to_pem, confirmed: true)
  provider.fasp_capabilities.create!(name: 'discovery', version: '0.1', enabled: false)
  File.write('/results/fasp-id', provider.id.to_s)
when 'fasp-enable'
  # Simulate provider activation locally; no FASP network request is sent.
  fake = Object.new
  def fake.post(*) = nil
  def fake.delete(*) = nil
  Fasp::Request.define_singleton_method(:new) { |*| fake }
  provider = Fasp::Provider.find(File.read('/results/fasp-id').to_i)
  provider.fasp_capabilities.first!.update!(enabled: true)
when 'fasp-check'
  provider = Fasp::Provider.find(File.read('/results/fasp-id').to_i)
  raise 'New capability table not readable' unless provider.capability_enabled?('discovery')
  raise 'Legacy rollback JSON not synchronized' unless provider[:capabilities].any? { |c| c['id'] == 'discovery' && c['enabled'] }
  puts 'PASS FASP capability and legacy mirror readable from ' + Mastodon::Version.to_s
when 'jobs-check'
  require 'sidekiq/api'
  raise 'Failed rehearsal background jobs' unless Sidekiq::RetrySet.new.size.zero? && Sidekiq::DeadSet.new.size.zero?
  raise 'Unexpected scheduled jobs' unless Sidekiq::ScheduledSet.new.size.zero?
  raise 'More than one background consumer' unless Sidekiq::ProcessSet.new.size == 1
  raise 'Missing explicit beta WebAuthn origin' unless WebAuthn.configuration.allowed_origins.include?('https://beta.nofan.xyz')
  raise 'Incorrect shared WebAuthn RP ID' unless WebAuthn.configuration.rp_id == 'nofan.xyz'
  puts 'PASS one worker, no retry/dead/scheduled jobs, canonical WebAuthn RP and explicit beta origin'
else
  raise 'Unknown probe mode'
end
