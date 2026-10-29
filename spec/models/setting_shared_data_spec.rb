# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Setting do
  around { |example| ClimateControl.modify(NOFAN_SHARED_DATA: 'true') { example.run } }

  it 'observes a database update despite a value cached by another application version' do
    described_class.site_title = 'First value'
    Rails.cache.write(described_class.cache_key('site_title'), 'Stale version cache')
    described_class.find_by!(var: 'site_title').update_columns(value: 'Committed by other Web'.to_yaml)

    expect(described_class.site_title).to eq 'Committed by other Web'
  end

  it 'keeps an explicitly persisted nil distinct from an absent setting' do
    described_class.site_title = nil

    expect(described_class.site_title).to be_nil
    described_class.find_by!(var: 'site_title').destroy!
    expect(described_class.site_title).to eq described_class.default_settings['site_title']
  end
end
