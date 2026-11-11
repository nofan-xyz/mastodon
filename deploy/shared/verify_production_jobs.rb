# frozen_string_literal: true

require 'sidekiq/api'
require 'json'
require 'time'
raise 'Wrong production target' unless ActiveRecord::Base.connection_db_config.database == 'mastodon_production' && ENV['NOFAN_SHARED_DATA'] == 'true'

started = Time.iso8601(ARGV.fetch(0)).to_f
processes = Sidekiq::ProcessSet.new.map { |process| { queues: process['queues'], concurrency: process['concurrency'], busy: process['busy'] } }
raise 'Wrong number of scheduler consumers' unless processes.one? { |process| process[:queues].include?('scheduler') }

errors = Sidekiq::RetrySet.new.select do |job|
  failed = job.item['failed_at'].to_f
  failed /= 1000 if failed > 1_000_000_000_000
  failed >= started && (job.item['error_class'].to_s.match?(/NameError|NoMethodError/) || job.item['error_message'].to_s.match?(/UndefinedColumn|UndefinedTable|uninitialized constant|unknown keyword/))
end
raise 'New compatibility errors present in retry queue' if errors.any?

puts JSON.generate(processes:, scheduler_consumers: 1, new_compatibility_errors: errors.size, newest_status_at: Status.order(id: :desc).limit(1).pick(:created_at))
