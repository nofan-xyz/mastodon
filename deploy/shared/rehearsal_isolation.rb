# frozen_string_literal: true

if ENV['NOFAN_REHEARSAL'] == 'true'
  safe = ENV['DB_HOST'] == 'db' && ENV['DB_NAME'] == 'mastodon_shared_rehearsal' && ENV['S3_BUCKET'] == 'beta-nofan-box' && ENV['S3_KEY_PREFIX'].to_s.start_with?('shared-rehearsal-')
  raise 'Unsafe shared rehearsal configuration' unless safe

  module NofanRehearsalRequest
    def perform(*)
      raise Mastodon::HostValidationError, 'Outbound federation is disabled in shared rehearsal'
    end
  end

  class NofanRehearsalJobs
    ALLOWED = %w(
      DistributionWorker FeedInsertWorker LocalNotificationWorker PushUpdateWorker
      PushConversationWorker MergeWorker UnmergeWorker MultiMergeIntoOwnHomeWorker
      RegenerationWorker BootstrapTimelineWorker GenerateOnThisDayWorker
      GenerateAnnualReportWorker PostProcessMediaWorker PollExpirationNotifyWorker
      UpdateAccountReachWorker FilteredNotificationCleanupWorker RemovalWorker
    ).freeze

    def call(_worker, job, *)
      yield if ALLOWED.include?(job['class'])
    end
  end

  Rails.application.config.action_mailer.delivery_method = :test
  Rails.application.config.action_mailer.perform_deliveries = false
  Rails.application.reloader.to_prepare do
    Request.prepend(NofanRehearsalRequest) unless Request < NofanRehearsalRequest
    ActionMailer::Base.delivery_method = :test
    ActionMailer::Base.perform_deliveries = false
  end
  Sidekiq.configure_client { |config| config.client_middleware { |chain| chain.prepend NofanRehearsalJobs } }
  Sidekiq.configure_server do |config|
    config.client_middleware { |chain| chain.prepend NofanRehearsalJobs }
    config.server_middleware { |chain| chain.prepend NofanRehearsalJobs }
  end
end
