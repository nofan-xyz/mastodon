# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db', 'migrate', '20261026050000_preserve_shared_legacy_feed_preferences')

RSpec.describe PreserveSharedLegacyFeedPreferences do
  around { |example| ClimateControl.modify(NOFAN_SHARED_DATA: 'true') { example.run } }

  it 'preserves the legacy own-boost behavior without changing other preferences or passwords' do
    user = Fabricate(:user, settings: UserSettings.new(future_key: 'keep'))
    password = user.encrypted_password

    described_class.new.up

    expect(user.reload.settings['display_own_boosts']).to be true
    expect(user.settings.as_json[:future_key]).to eq 'keep'
    expect(user.encrypted_password).to eq password
  end

  it 'does not overwrite an explicit opt-out' do
    user = Fabricate(:user, settings: UserSettings.new(display_own_boosts: false))

    described_class.new.up

    expect(user.reload.settings['display_own_boosts']).to be false
  end

  it 'does not change native standalone installations' do
    user = Fabricate(:user)
    original = user.settings.as_json

    ClimateControl.modify(NOFAN_SHARED_DATA: nil) { described_class.new.up }

    expect(user.reload.settings.as_json).to eq original
  end
end
