# frozen_string_literal: true

class Scheduler::OnThisDayScheduler
  include Sidekiq::Worker

  sidekiq_options retry: 0, lock: :until_executed, lock_ttl: 1.day.to_i

  # At 23:00 CST, spread tomorrow's jobs across 50 minutes. At 00:05,
  # fill any gaps for today (new accounts, missed or failed precomputation).
  def perform(days_ahead = 0)
    date = OnThisDay.today_cst + days_ahead

    User.confirmed
      .where.not(account_id: OnThisDayRecord.where(date: date).select(:account_id))
      .includes(:account)
      .find_each do |user|
      next unless user.account && user.setting_on_this_day_enabled

      if days_ahead.positive?
        GenerateOnThisDayWorker.perform_in(Random.rand(50.minutes.to_i), user.account_id, date.iso8601)
      else
        GenerateOnThisDayWorker.perform_async(user.account_id, date.iso8601)
      end
    end
  end
end
