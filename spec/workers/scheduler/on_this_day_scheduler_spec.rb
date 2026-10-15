# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Scheduler::OnThisDayScheduler do
  let!(:enabled_user) { Fabricate(:user, confirmed_at: Time.now.utc) }
  let!(:disabled_user) { Fabricate(:user, confirmed_at: Time.now.utc) }
  let!(:unconfirmed_user) { Fabricate(:user, confirmed_at: nil) }

  before do
    disabled_user.settings['on_this_day_enabled'] = false
    disabled_user.save!
  end

  it 'spreads tomorrow jobs within 23:00–23:50 Beijing time and honors default settings' do
    travel_to Time.utc(2026, 10, 15, 15) do
      described_class.new.perform(1)

      jobs = GenerateOnThisDayWorker.jobs
      expect(jobs.pluck('args')).to eq [[enabled_user.account_id, '2026-10-16']]
      expect(jobs.pluck('args')).to_not include([unconfirmed_user.account_id, '2026-10-16'])
      expect(jobs.first['at'] || Time.now.to_f).to be_between(Time.now.to_f, 50.minutes.from_now.to_f).inclusive
    end
  end

  it 'only fills missing records for today after midnight' do
    travel_to Time.utc(2026, 10, 15, 16, 5) do
      Fabricate(:on_this_day_record, account: enabled_user.account, date: Date.new(2026, 10, 16))
      missing_user = Fabricate(:user, confirmed_at: Time.now.utc)

      described_class.new.perform

      expect(GenerateOnThisDayWorker.jobs.pluck('args')).to eq [[missing_user.account_id, '2026-10-16']]
    end
  end
end
