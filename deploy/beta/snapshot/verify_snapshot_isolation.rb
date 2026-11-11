# frozen_string_literal: true

require 'json'
raise 'Wrong database' unless ActiveRecord::Base.connection_db_config.database == 'mastodon_beta'
raise 'Mail enabled' unless ActionMailer::Base.delivery_method == :test && !ActionMailer::Base.perform_deliveries

begin
  Request.new(:get, 'https://nofan.xyz/health').perform
  raise 'Request was allowed'
rescue IOError => e
  raise unless e.message.include?('disabled in the beta snapshot')
end
middleware = NofanSnapshotJobs.new
%w(ActivityPub::DeliveryWorker ActivityPub::ProcessingWorker EmailDistributionWorker Web::PushNotificationWorker Webhooks::DeliveryWorker Scheduler::VacuumScheduler RemovalWorker).each do |klass|
  called = false
  middleware.call(nil, { 'class' => klass }, nil) { called = true }
  raise "Unsafe job allowed: #{klass}" if called
end
called = false
middleware.call(nil, { 'class' => 'RegenerationWorker' }, nil) { called = true }
raise 'Local feeds blocked' unless called

ingress = NofanSnapshotIngress.new(->(_env) { [200, {}, ['ok']] })
['/inbox', '/users/test/inbox', '/.well-known/webfinger', '/api/v1/fasp'].each do |path|
  raise 'Ingress allowed' unless ingress.call({ 'PATH_INFO' => path })[0] == 403
end
raise 'ActivityPub discovery allowed' unless ingress.call({ 'PATH_INFO' => '/users/test', 'HTTP_ACCEPT' => 'application/activity+json' })[0] == 403
raise 'Local API blocked' unless ingress.call({ 'PATH_INFO' => '/api/v1/accounts/verify_credentials' })[0] == 200
raise 'WebAuthn origin' unless WebAuthn.configuration.allowed_origins == ['https://beta.nofan.xyz'] && WebAuthn.configuration.rp_id == 'nofan.xyz'

puts JSON.generate(isolation: 'passed', mail: 'disabled', signed_http: 'blocked', external_jobs: 'blocked', local_feeds: 'allowed', database: 'mastodon_beta')
