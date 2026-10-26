# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User do
  around { |example| ClimateControl.modify(NOFAN_SHARED_DATA: 'true') { example.run } }

  let!(:user) { Fabricate(:user) }

  it 'merges different preferences from two previously loaded user records' do
    first = described_class.find(user.id)
    second = described_class.find(user.id)

    first.settings['web.reduce_motion'] = true
    first.save!
    second.settings['web.theme_color'] = 'blue'
    second.save!

    expect(user.reload.settings['web.reduce_motion']).to be true
    expect(user.settings['web.theme_color']).to eq 'blue'
  end

  it 'preserves newer unknown keys when an older preferences object is saved' do
    stale = described_class.find(user.id)
    current = described_class.find(user.id)
    values = current.settings.as_json.merge(future_shared_key: 'newer value')
    current.update!(settings: UserSettings.new(values))

    stale.settings['web.reduce_motion'] = true
    stale.save!

    expect(user.reload.settings.as_json[:future_shared_key]).to eq 'newer value'
  end

  it 'keeps a deliberately removed key removed without losing another writer preference' do
    user.update!(settings: UserSettings.new(user.settings.as_json.merge(future_shared_key: 'remove me')))
    first = described_class.find(user.id)
    second = described_class.find(user.id)
    first.settings['web.theme_color'] = 'blue'
    first.save!
    second.update!(settings: UserSettings.new(second.settings.as_json.except(:future_shared_key)))

    expect(user.reload.settings.as_json).to_not have_key :future_shared_key
    expect(user.settings['web.theme_color']).to eq 'blue'
  end

  it 'uses the last committed edit when both writers change the same preference' do
    first = described_class.find(user.id)
    second = described_class.find(user.id)
    first.settings['web.theme_color'] = 'blue'
    first.save!
    second.settings['web.theme_color'] = 'red'
    second.save!

    expect(user.reload.settings['web.theme_color']).to eq 'red'
  end
end
