# frozen_string_literal: true

require 'rails_helper'

RSpec.describe OnThisDay do
  let(:account) { Fabricate(:account, created_at: 3.years.ago) }

  # Fabricate a status at noon (CST) on this month/day of a past year,
  # safely inside that day's CST range and before the current time.
  def status_on_this_day(years_ago, **kwargs)
    past = described_class.today_cst.advance(years: -years_ago)
    Fabricate(:status, account: account, created_at: described_class.cst_time_zone.local(past.year, past.month, past.day, 12), **kwargs)
  end

  describe '.today_cst' do
    it 'returns the current date in the Asia/Shanghai time zone' do
      expect(described_class.today_cst)
        .to eq Time.now.utc.in_time_zone(described_class::CST_ZONE).to_date
    end
  end

  describe '#state' do
    it 'returns pending when no record exists for today' do
      expect(described_class.new(account).state).to eq 'pending'
    end

    it 'returns empty when the record has no statuses' do
      Fabricate(:on_this_day_record, account: account)

      expect(described_class.new(account).state).to eq 'empty'
    end

    it 'returns ready when the record has statuses' do
      status = Fabricate(:status, account: account)
      Fabricate(:on_this_day_record, account: account, data: { 'years' => { '2025' => [status.id.to_s] } })

      expect(described_class.new(account).state).to eq 'ready'
    end
  end

  describe '#generate' do
    it 'precomputes tomorrow at 23:30 and becomes ready exactly at Beijing midnight' do
      target_date = Date.new(2026, 10, 16)
      travel_to Time.utc(2026, 10, 15, 15, 30) do
        account.update!(created_at: Time.utc(2020, 1, 1))
        past_status = Fabricate(:status, account: account, created_at: Time.utc(2025, 10, 15, 16))
        Fabricate(:status, account: account, created_at: Time.utc(2025, 10, 15, 15, 59, 59))

        described_class.new(account, target_date).generate

        expect(described_class.new(account).state).to eq 'pending'
        expect(OnThisDayRecord.find_by(account: account, date: target_date).status_ids).to eq [past_status.id.to_s]
      end

      travel_to Time.utc(2026, 10, 15, 16) do
        expect(described_class.new(account).state).to eq 'ready'
      end
    end

    it 'groups New Year memories using their Beijing year' do
      travel_to Time.utc(2026, 12, 31, 15, 30) do
        account.update!(created_at: Time.utc(2020, 1, 1))
        past_status = Fabricate(:status, account: account, created_at: Time.utc(2025, 12, 31, 16, 30))
        described_class.new(account, Date.new(2027, 1, 1)).generate

        expect(OnThisDayRecord.find_by(account: account).data).to eq('years' => { '2026' => [past_status.id.to_s] })
      end
    end

    it 'is a no-op when a record already exists for today' do
      Fabricate(:on_this_day_record, account: account)

      expect { described_class.new(account).generate }
        .to not_change(OnThisDayRecord, :count)
    end

    it 'collects statuses from this day in past years, grouped by year' do
      last_year = status_on_this_day(1)
      two_years_ago = status_on_this_day(2)

      described_class.new(account).generate

      record = OnThisDayRecord.find_by(account: account, date: described_class.today_cst)
      expect(record.data['years'].keys)
        .to contain_exactly(last_year.created_at.year.to_s, two_years_ago.created_at.year.to_s)
      expect(record.status_ids)
        .to contain_exactly(last_year.id.to_s, two_years_ago.id.to_s)
    end

    it 'includes public, unlisted and private statuses but excludes direct messages' do
      public_status   = status_on_this_day(1, visibility: :public)
      unlisted_status = status_on_this_day(1, visibility: :unlisted)
      private_status  = status_on_this_day(1, visibility: :private)
      status_on_this_day(1, visibility: :direct)

      described_class.new(account).generate

      expect(OnThisDayRecord.find_by(account: account).status_ids)
        .to contain_exactly(public_status.id.to_s, unlisted_status.id.to_s, private_status.id.to_s)
    end

    it 'excludes statuses from other days' do
      matching = status_on_this_day(1)
      other_day = described_class.today_cst.advance(years: -1, days: -1)
      Fabricate(:status, account: account, created_at: described_class.cst_time_zone.local(other_day.year, other_day.month, other_day.day, 12))

      described_class.new(account).generate

      expect(OnThisDayRecord.find_by(account: account).status_ids)
        .to contain_exactly(matching.id.to_s)
    end

    it 'excludes statuses from the current year' do
      Fabricate(:status, account: account)

      described_class.new(account).generate

      expect(OnThisDayRecord.find_by(account: account).status_ids).to be_empty
    end
  end
end
