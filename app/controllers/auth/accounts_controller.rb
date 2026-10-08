# frozen_string_literal: true

class Auth::AccountsController < ApplicationController
  skip_before_action :require_functional!
  skip_before_action :update_user_sign_in

  before_action :authenticate_user!, only: :add
  before_action :check_current_account!, only: [:add, :switch, :destroy]

  def index
    saved_accounts.remember(current_session) if user_signed_in?

    render json: {
      current_account_id: current_account&.id&.to_s,
      accounts: saved_accounts.sessions.filter_map do |activation|
        user = activation.user
        next unless user.active_for_authentication? && user.functional?

        {
          id: user.account.id.to_s,
          username: user.account.username,
          display_name: user.account.display_name.presence || user.account.username,
          avatar: user.account.avatar.url(:original),
        }
      end,
    }
  end

  def add
    saved_accounts.remember(current_session)
    leave_current_account
    respond_to do |format|
      format.html { redirect_to new_user_session_path }
      format.json { render json: { redirect_to: new_user_session_path } }
    end
  end

  def switch
    target = saved_accounts.sessions.find { |activation| activation.user.account.id.to_s == params[:account_id].to_s }
    raise ActiveRecord::RecordNotFound unless target&.user&.active_for_authentication? && target.user.functional?

    saved_accounts.remember(current_session) if user_signed_in?
    leave_current_account
    cookies.signed['_session_id'] = { value: target.session_id, httponly: true, same_site: :lax, expires: 1.year.from_now }
    sign_in(:user, target.user)
    respond_to do |format|
      format.html { redirect_to '/home' }
      format.json { render json: { redirect_to: '/home' } }
    end
  end

  def destroy
    target = saved_accounts.sessions.find { |activation| activation.user.account.id.to_s == params[:account_id].to_s }
    raise ActiveRecord::RecordNotFound unless target && target.user_id != current_user&.id

    saved_accounts.forget(target.session_id)
    target.destroy!
    head 204
  end

  private

  def saved_accounts
    @saved_accounts ||= BrowserAccountSessions.new(cookies)
  end

  def check_current_account!
    return if params[:current_account_id].to_s == current_account&.id.to_s

    head 409
  end

  def leave_current_account
    request.env['mastodon.preserve_account_session'] = true
    sign_out(:user)
    reset_session
  ensure
    request.env.delete('mastodon.preserve_account_session')
  end
end
