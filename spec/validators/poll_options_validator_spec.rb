# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PollOptionsValidator do
  subject { Fabricate.build :poll }

  context 'when poll has unique valid options' do
    it { is_expected.to allow_values(%w(One Two)).for(:options) }
  end

  [false, true].each do |multiple|
    context "when multiple choice is #{multiple}" do
      before { subject.multiple = multiple }

      it 'accepts twelve options of fifty characters each' do
        options = Array.new(12) { |index| "#{index.to_s.rjust(2, '0')}#{'字' * 48}" }

        expect(subject).to allow_value(options).for(:options)
      end

      it 'rejects a thirteenth option' do
        options = Array.new(13) { |index| "Option #{index}" }

        expect(subject).to_not allow_value(options).for(:options).with_message(I18n.t('polls.errors.too_many_options', max: 12))
      end

      it 'rejects an option longer than fifty characters' do
        expect(subject).to_not allow_value(['字' * 51, 'Other']).for(:options).with_message(I18n.t('polls.errors.over_character_limit', max: 50))
      end
    end
  end

  context 'when poll has too few options' do
    it { is_expected.to_not allow_values([]).for(:options).with_message(I18n.t('polls.errors.too_few_options')) }
  end

  context 'when poll has too many options' do
    before { stub_const 'PollOptionsValidator::MAX_OPTIONS', 2 }

    it { is_expected.to_not allow_values(%w(One Two Three)).for(:options).with_message(I18n.t('polls.errors.too_many_options', max: 2)) }
  end

  context 'when poll has duplicate options' do
    it { is_expected.to_not allow_values(%w(One One One)).for(:options).with_message(I18n.t('polls.errors.duplicate_options')) }
  end

  describe 'poll option length limits' do
    let(:limit) { 5 }

    before { stub_const 'PollOptionsValidator::MAX_OPTION_CHARS', limit }

    context 'when poll has acceptable length options' do
      it { is_expected.to allow_values(%w(One Two)).for(:options) }
    end

    context 'when poll has multibyte and ZWJ emoji options' do
      let(:options) { ['✨' * limit, '🏳️‍⚧️' * limit] }

      it { is_expected.to allow_values(options).for(:options) }
    end

    context 'when poll has options that are too long' do
      it { is_expected.to_not allow_values(%w(Airplane Two Three)).for(:options).with_message(I18n.t('polls.errors.over_character_limit', max: limit)) }
    end
  end
end
