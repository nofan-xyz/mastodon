# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Browser account switching' do
  let(:alice) { Fabricate(:user) }
  let(:bob) { Fabricate(:user) }

  def login(user, **credentials)
    post user_session_path, params: { user: { email: user.email, password: user.password }.merge(credentials) }
  end

  def account_list
    get auth_accounts_path
    response.parsed_body
  end

  def add_account(user)
    post auth_accounts_add_path, params: { current_account_id: user.account.id }, as: :json
  end

  def switch_to(user, from: nil)
    post auth_accounts_switch_path, params: { account_id: user.account.id, current_account_id: from&.account&.id }, as: :json
  end

  it 'requires authentication to add an account' do
    post auth_accounts_add_path

    expect(response).to redirect_to(new_user_session_path)
  end

  it 'does not expose accounts that have not logged in to this browser' do
    login(alice)
    expect(account_list['accounts'].pluck('id')).to eq [alice.account.id.to_s]

    switch_to(bob, from: alice)

    expect(response).to have_http_status(404)
    expect(account_list['current_account_id']).to eq alice.account.id.to_s
  end

  it 'retains the first session while adding an account and switches both ways' do
    login(alice)
    original_session = alice.session_activations.last
    add_account(alice)

    expect(response.parsed_body['redirect_to']).to eq new_user_session_path
    expect(SessionActivation.exists?(original_session.id)).to be true
    expect(account_list['current_account_id']).to be_nil

    login(bob)
    expect(account_list['accounts'].pluck('id')).to contain_exactly(alice.account.id.to_s, bob.account.id.to_s)

    switch_to(alice, from: bob)
    expect(response).to have_http_status(200)
    expect(account_list['current_account_id']).to eq alice.account.id.to_s
    expect(alice.session_activations.count).to eq 1

    switch_to(bob, from: alice)
    expect(account_list['current_account_id']).to eq bob.account.id.to_s
    expect(bob.session_activations.count).to eq 1
  end

  it 'allows returning to the saved account after a failed new login' do
    login(alice)
    add_account(alice)
    login(bob, password: 'incorrect')

    get new_user_session_path
    expect(response.body).to include(alice.account.username)

    switch_to(alice)
    expect(account_list['current_account_id']).to eq alice.account.id.to_s
  end

  it 'removes a logged out account without revoking other saved accounts' do
    login(alice)
    add_account(alice)
    login(bob)
    delete destroy_user_session_path

    expect(bob.session_activations.count).to eq 0
    expect(account_list['accounts'].pluck('id')).to eq [alice.account.id.to_s]

    switch_to(bob)
    expect(response).to have_http_status(404)

    switch_to(alice)
    expect(account_list['current_account_id']).to eq alice.account.id.to_s
  end

  it 'rejects a saved session revoked on another device' do
    login(alice)
    add_account(alice)
    login(bob)
    alice.session_activations.destroy_all

    switch_to(alice, from: bob)

    expect(response).to have_http_status(404)
    expect(account_list['accounts'].pluck('id')).to eq [bob.account.id.to_s]
  end

  it 'rejects a disabled saved account' do
    login(alice)
    add_account(alice)
    login(bob)
    alice.update!(disabled: true)

    switch_to(alice, from: bob)

    expect(response).to have_http_status(404)
    expect(account_list['accounts'].pluck('id')).to eq [bob.account.id.to_s]
  end

  it 'rejects a stale tab whose account differs from the browser session' do
    login(alice)
    add_account(alice)
    login(bob)

    add_account(alice)

    expect(response).to have_http_status(409)
    expect(account_list['current_account_id']).to eq bob.account.id.to_s
  end

  it 'does not save a second account before completing two-factor authentication' do
    login(alice)
    add_account(alice)
    bob.update!(otp_required_for_login: true, otp_secret: User.generate_otp_secret(32))
    login(bob)

    expect(account_list['accounts'].pluck('id')).to eq [alice.account.id.to_s]
    expect(account_list['current_account_id']).to be_nil
    expect(bob.session_activations).to be_empty
  end

  it 'saves the second account after completing two-factor authentication' do
    login(alice)
    add_account(alice)
    bob.update!(otp_required_for_login: true, otp_secret: User.generate_otp_secret(32))
    login(bob)
    post user_session_path, params: { user: { otp_attempt: bob.current_otp } }

    expect(account_list['current_account_id']).to eq bob.account.id.to_s
    expect(account_list['accounts'].pluck('id')).to contain_exactly(alice.account.id.to_s, bob.account.id.to_s)
  end

  it 'rejects a switch request without a CSRF token' do
    login(alice)
    original = ActionController::Base.allow_forgery_protection
    ActionController::Base.allow_forgery_protection = true

    switch_to(alice, from: alice)

    expect(response).to have_http_status(422)
    expect(account_list['current_account_id']).to eq alice.account.id.to_s
  ensure
    ActionController::Base.allow_forgery_protection = original
  end

  it 'retains only the five most recently used accounts' do
    users = Fabricate.times(6, :user)
    users.each do |user|
      login(user)
      add_account(user)
    end

    expect(account_list['accounts'].size).to eq 5
    expect(account_list['accounts'].pluck('id')).to_not include(users.first.account.id.to_s)

    switch_to(users.first)
    expect(response).to have_http_status(404)
  end

  it 'removes and revokes a saved account while keeping the current login' do
    login(alice)
    add_account(alice)
    login(bob)

    delete auth_saved_account_path(account_id: alice.account.id), params: { current_account_id: bob.account.id }, as: :json

    expect(response).to have_http_status(204)
    expect(alice.session_activations).to be_empty
    expect(account_list['accounts'].pluck('id')).to eq [bob.account.id.to_s]
    expect(account_list['current_account_id']).to eq bob.account.id.to_s
    expect(User.exists?(alice.id)).to be true

    switch_to(alice, from: bob)
    expect(response).to have_http_status(404)
  end

  it 'does not remove the current account through the saved-account endpoint' do
    login(alice)

    delete auth_saved_account_path(account_id: alice.account.id), params: { current_account_id: alice.account.id }, as: :json

    expect(response).to have_http_status(404)
    expect(account_list['current_account_id']).to eq alice.account.id.to_s
  end

  it 'cannot remove a session that was not saved in this browser' do
    login(alice)
    other_session = bob.activate_session(ActionDispatch::Request.new(Rack::MockRequest.env_for('/')))

    delete auth_saved_account_path(account_id: bob.account.id), params: { current_account_id: alice.account.id }, as: :json

    expect(response).to have_http_status(404)
    expect(SessionActivation.active?(other_session)).to be true
  end
end
