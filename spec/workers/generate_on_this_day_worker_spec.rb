# frozen_string_literal: true

require 'rails_helper'

RSpec.describe GenerateOnThisDayWorker do
  let(:user) { Fabricate(:user, confirmed_at: Time.now.utc) }

  it 'precomputes a fixed date and keeps it when a retry executes after midnight' do
    travel_to Time.utc(2026, 10, 15, 15, 30) do
      described_class.new.perform(user.account_id, '2026-10-16')
    end

    travel_to Time.utc(2026, 10, 16, 16, 30) do
      expect { described_class.new.perform(user.account_id, '2026-10-16') }
        .to not_change(OnThisDayRecord, :count)
    end

    expect(OnThisDayRecord.where(account: user.account).pluck(:date)).to eq [Date.new(2026, 10, 16)]
  end

  it 'still accepts jobs queued before the date argument was added' do
    described_class.new.perform(user.account_id)

    expect(OnThisDayRecord.where(account: user.account).pluck(:date)).to eq [OnThisDay.today_cst]
  end

  it 'skips a user who disables the feature after scheduling' do
    user.settings['on_this_day_enabled'] = false
    user.save!

    expect { described_class.new.perform(user.account_id, '2026-10-16') }
      .to not_change(OnThisDayRecord, :count)
  end
end
