# frozen_string_literal: true

class GenerateOnThisDayWorker
  include Sidekiq::Worker

  sidekiq_options lock: :until_executed, lock_ttl: 2.hours.to_i

  # Keep the requested date even if a scheduled job or retry runs after midnight.
  def perform(account_id, date = nil)
    account = Account.find(account_id)
    return unless account.user&.setting_on_this_day_enabled

    OnThisDay.new(account, date.present? ? Date.iso8601(date) : OnThisDay.today_cst).generate
  rescue ActiveRecord::RecordNotFound, ActiveRecord::RecordNotUnique
    true
  end
end
