# frozen_string_literal: true

require 'rails_helper'

RSpec.describe StatusesSearchService do
  describe '#call' do
    let!(:status) { Fabricate(:status, text: 'status number one') }
    let(:results) { subject.call('one', status.account, limit: 5) }

    before { Fabricate(:status, text: 'status number two') }

    context 'when elasticsearch is enabled', :search do
      it 'runs a search for statuses' do
        expect(results)
          .to have_attributes(
            size: 1,
            first: eq(status)
          )
      end
    end

    context 'when searching Chinese text', :search do
      let!(:matching)  { Fabricate(:status, text: '在那年今日看到了三年前的回忆') }
      let!(:scattered) { Fabricate(:status, text: '今年那个日志项目今天上线了') }

      it 'matches the exact substring rather than scattered characters' do
        results = subject.call('那年今日', matching.account, limit: 5)

        expect(results).to include(matching)
        expect(results).to_not include(scattered)
      end

      it 'still matches a lone character via the unigram fallback' do
        single_char = Fabricate(:status, text: '猫')

        expect(subject.call('猫', single_char.account, limit: 5))
          .to include(single_char)
      end

      it 'matches documents whose words are not adjacent when no exact substring exists' do
        split_words = Fabricate(:status, text: '今日翻到了三年前的回忆')
        partial     = Fabricate(:status, text: '今日天气不错')

        results = subject.call('今日回忆', split_words.account, limit: 5)

        expect(results).to include(split_words)
        expect(results).to_not include(partial)
      end
    end
  end

  context 'with migrated nofan search filters', :search do
    let(:account) { Fabricate(:user).account }
    let!(:matching_status) { Fabricate(:status, account: account, text: '今日回忆：一次旅行', visibility: :private, created_at: Time.utc(2024, 10, 20, 4)) }
    let!(:other_status) { Fabricate(:status, account: account, text: '今日天气很好', visibility: :private, created_at: Time.utc(2024, 10, 22, 4)) }

    before { Chewy.client.indices.refresh(index: StatusesIndex.index_name) }

    it 'keeps Chinese phrase matching for the current account' do
      results = described_class.new.call('今日回忆 from:me', account, limit: 10)

      expect(results).to include(matching_status)
      expect(results).to_not include(other_status)
    end

    it 'allows personal date-only filters without a keyword' do
      expect(described_class.new.call('from:me after:2024-10-19 before:2024-10-21', account, limit: 10))
        .to contain_exactly(matching_status)
    end
  end
end
