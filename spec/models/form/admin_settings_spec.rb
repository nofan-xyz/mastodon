# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Form::AdminSettings do
  describe '#flavour_and_skin' do
    it 'shows the merged skin for a stored Space Fanfou site default' do
      settings = described_class.new(flavour: 'mastodon-ui', skin: 'space_fanfou')

      expect(settings.flavour_and_skin).to eq 'mastodon-ui/fanfou_classic'
    end

    it 'saves a legacy selection as Fanfou Classic' do
      settings = described_class.new(flavour_and_skin: 'mastodon-ui/space_fanfou')
      settings.save

      expect(Setting.flavour).to eq 'mastodon-ui'
      expect(Setting.skin).to eq 'fanfou_classic'
    end
  end

  describe 'Validations' do
    describe 'site_contact_username' do
      context 'with no accounts' do
        it { is_expected.to_not allow_value('Test').for(:site_contact_username) }
      end

      context 'with an account' do
        before { Fabricate(:account, username: 'Glorp') }

        it { is_expected.to_not allow_value('Test').for(:site_contact_username) }
        it { is_expected.to allow_value('Glorp').for(:site_contact_username) }
      end
    end
  end

  describe '#save' do
    describe 'updating digest values' do
      context 'when updating custom css to real value' do
        subject { described_class.new(custom_css: css) }

        let(:css) { 'body { color: red; }' }
        let(:digested) { Digest::SHA256.hexdigest(css) }

        it 'changes relevant digest value' do
          expect { subject.save }
            .to(change { Rails.cache.read(:setting_digest_custom_css) }.to(digested))
        end
      end

      context 'when updating custom css to empty value' do
        subject { described_class.new(custom_css: '') }

        before { Rails.cache.write(:setting_digest_custom_css, 'previous-value') }

        it 'changes relevant digest value' do
          expect { subject.save }
            .to(change { Rails.cache.read(:setting_digest_custom_css) }.to(be_blank))
        end
      end

      context 'when updating other fields' do
        subject { described_class.new(site_contact_email: 'test@example.host') }

        it 'does not update digests' do
          expect { subject.save }
            .to(not_change { Rails.cache.read(:setting_digest_custom_css) })
        end
      end
    end
  end

  describe '#persisted?' do
    it { is_expected.to be_persisted }
  end
end
