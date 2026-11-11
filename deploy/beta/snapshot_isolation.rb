# frozen_string_literal: true

# Mounted only in the independent production snapshot preview, never in production.
if ENV['NOFAN_SNAPSHOT_MODE'] == 'true'
  raise 'Snapshot domain guard failed' unless ENV['WEB_DOMAIN'] == 'beta.nofan.xyz' && ENV['DB_NAME'] == 'mastodon_beta' && ENV['S3_BUCKET'] == 'beta-nofan-box'

  # Mastodon's signed HTTP client must never use copied account keys externally.
  module NofanSnapshotOutboundRequest
    def perform(*)
      raise IOError, 'Outbound Mastodon requests are disabled in the beta snapshot'
    end
  end

  class NofanSnapshotIngress
    def initialize(app)
      @app = app
    end

    def call(env)
      path = env.fetch('PATH_INFO', '')
      activitypub = [env['HTTP_ACCEPT'], env['CONTENT_TYPE']].compact.any? { |value| value.match?(%r{application/(activity\+json|ld\+json)}i) }
      blocked = path.match?(%r{\A/(inbox|users/[^/]+/(inbox|outbox)|actor|api/v1/fasp|api/v1/push/subscription|api/web/push_subscriptions|\.well-known/(webfinger|host-meta)|nodeinfo)(/|\z)})
      return [403, { 'content-type' => 'text/plain' }, ['Federation is disabled in this snapshot']] if activitypub || blocked

      @app.call(env)
    end
  end

  Rails.application.config.middleware.insert_before 0, NofanSnapshotIngress

  # Only local UI, feed and media processing jobs are accepted. In particular,
  # federation, mail, push, imports, deletion and scheduler jobs are discarded.
  class NofanSnapshotJobs
    ALLOWED = %w(
      DistributionWorker FeedInsertWorker LocalNotificationWorker
      PushUpdateWorker PushConversationWorker MergeWorker UnmergeWorker
      MultiMergeIntoOwnHomeWorker RegenerationWorker BootstrapTimelineWorker
      GenerateOnThisDayWorker GenerateAnnualReportWorker PostProcessMediaWorker
      PollExpirationNotifyWorker UpdateAccountReachWorker
      FilteredNotificationCleanupWorker
    ).freeze

    def call(_worker, job, *)
      return unless ALLOWED.include?(job['class'])

      yield
    end
  end

  Rails.application.config.action_mailer.delivery_method = :test
  Rails.application.config.action_mailer.perform_deliveries = false
  # Credentials registered at nofan.xyz can also be used from its beta subdomain.
  WebAuthn.configure { |config| config.rp_id = 'nofan.xyz' }

  Rails.application.reloader.to_prepare do
    Request.prepend(NofanSnapshotOutboundRequest) unless Request < NofanSnapshotOutboundRequest
    ActionMailer::Base.delivery_method = :test
    ActionMailer::Base.perform_deliveries = false
  end

  Sidekiq.configure_client { |config| config.client_middleware { |chain| chain.prepend NofanSnapshotJobs } }
  Sidekiq.configure_server do |config|
    config.client_middleware { |chain| chain.prepend NofanSnapshotJobs }
    config.server_middleware { |chain| chain.prepend NofanSnapshotJobs }
  end
end
