# frozen_string_literal: true

class Api::V1::OnThisDayController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!
  before_action :require_on_this_day_enabled!, only: [:show]

  def show
    record = OnThisDayRecord.find_by(
      account_id: current_account.id,
      date: OnThisDay.today_cst
    )

    raise ActiveRecord::RecordNotFound unless record

    @presenter = OnThisDayPresenter.new(record)
    @relationships = StatusRelationshipsPresenter.new(@presenter.statuses, current_account.id)

    render json: @presenter,
           serializer: REST::OnThisDaySerializer,
           relationships: @relationships
  end

  def state
    date = OnThisDay.today_cst
    return render json: { state: 'disabled', date: date.to_s } unless current_account.user.setting_on_this_day_enabled

    # Missing records are generated asynchronously so history queries never
    # hold up the state request, even if overnight precomputation was missed.
    current_state = OnThisDay.new(current_account, date).state
    GenerateOnThisDayWorker.perform_async(current_account.id, date.iso8601) if current_state == 'pending'
    render json: { state: current_state, date: date.to_s }
  rescue => e
    Rails.logger.error "OnThisDay#state failed: #{e.class}: #{e.message}"
    render json: { state: 'error', date: OnThisDay.today_cst.to_s }, status: 500
  end

  private

  def require_on_this_day_enabled!
    render json: { error: 'Feature not enabled' }, status: 403 unless current_account.user.setting_on_this_day_enabled
  end
end
