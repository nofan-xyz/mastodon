# frozen_string_literal: true

require 'rails_helper'

RSpec.describe InitialStateSerializer do
  let(:user) { Fabricate(:user) }
  let(:presenter) { InitialStatePresenter.new(current_account: user.account, settings: {}) }

  it 'explicitly marks a disabled feature so the navigation never flashes while checking' do
    user.settings['on_this_day_enabled'] = false
    user.save!

    expect(described_class.new(presenter).meta[:on_this_day])
      .to eq(state: 'disabled', date: OnThisDay.today_cst.to_s)
  end

  it 'selects a precomputed record only after the Beijing date changes' do
    Fabricate(:on_this_day_record, account: user.account, date: Date.new(2026, 10, 16))

    travel_to Time.utc(2026, 10, 15, 15, 59, 59) do
      expect(described_class.new(presenter).meta[:on_this_day])
        .to eq(state: 'pending', date: '2026-10-15')
    end

    travel_to Time.utc(2026, 10, 15, 16) do
      expect(described_class.new(presenter).meta[:on_this_day])
        .to eq(state: 'empty', date: '2026-10-16')
    end
  end
end
