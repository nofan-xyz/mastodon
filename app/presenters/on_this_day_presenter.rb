# frozen_string_literal: true

class OnThisDayPresenter
  alias read_attribute_for_serialization send

  attr_reader :record

  def initialize(record)
    @record = record
  end

  def date
    record.date.to_s
  end

  def data
    { 'years' => statuses.group_by { |status| status.created_at.in_time_zone(OnThisDay::CST_ZONE).year.to_s }.transform_values { |items| items.map { |status| status.id.to_s } } }
  end

  def accounts
    @accounts ||= Account.where(id: record.account_id).includes(:account_stat)
  end

  def statuses
    @statuses ||= record.account.statuses
      .where(id: record.status_ids, visibility: %i(public unlisted private))
      .without_reblogs
      .without_replies
      .kept
      .not_excluded_by_account(record.account)
      .not_domain_blocked_by_account(record.account)
      .with_includes
      .order(created_at: :asc)
  end

  def self.model_name
    @model_name ||= ActiveModel::Name.new(self)
  end
end
