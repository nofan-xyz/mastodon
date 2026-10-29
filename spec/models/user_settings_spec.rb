# frozen_string_literal: true

require 'rails_helper'

RSpec.describe UserSettings do
  subject { described_class.new(json) }

  let(:json) { {} }

  describe '#[]' do
    context 'when setting is not set' do
      it 'returns default value' do
        expect(subject[:always_send_emails]).to be false
      end

      it 'uses plain text as the default posting format' do
        expect(subject[:default_content_type]).to eq 'text/plain'
      end

      it 'shows the posting format selector by default' do
        expect(subject[:show_content_type_choice]).to be true
      end
    end

    context 'when setting is set' do
      let(:json) { { default_language: 'fr' } }

      it 'returns value' do
        expect(subject[:default_language]).to eq 'fr'
      end

      it 'uses an explicitly disabled posting format selector setting' do
        json[:show_content_type_choice] = false

        expect(subject[:show_content_type_choice]).to be false
      end
    end

    context 'when setting was not defined' do
      it 'raises error' do
        expect { subject[:foo] }.to raise_error described_class::KeyError
      end
    end
  end

  describe '#[]=' do
    context 'when value matches type' do
      before do
        subject[:always_send_emails] = true
      end

      it 'updates value' do
        expect(subject[:always_send_emails]).to be true
      end
    end

    context 'when value needs to be type-cast' do
      before do
        subject[:always_send_emails] = '1'
      end

      it 'updates value with a type-cast' do
        expect(subject[:always_send_emails]).to be true
      end
    end

    context 'when the setting has a closed set of values' do
      it 'updates the attribute when given a valid value' do
        expect { subject[:'web.display_media'] = :show_all }.to change { subject[:'web.display_media'] }.from('default').to('show_all')
      end

      it 'raises an error when given an invalid value' do
        expect { subject[:'web.display_media'] = 'invalid value' }.to raise_error ArgumentError
      end

      it 'accepts a supported posting format' do
        expect { subject[:default_content_type] = 'text/markdown' }.to change { subject[:default_content_type] }.from('text/plain').to('text/markdown')
      end

      it 'rejects an unsupported posting format' do
        expect { subject[:default_content_type] = 'application/javascript' }.to raise_error ArgumentError
      end
    end
  end

  describe '#update' do
    before do
      subject.update(always_send_emails: true, default_language: 'fr', default_privacy: nil, display_own_boosts: true)
    end

    it 'updates values' do
      expect(subject[:always_send_emails]).to be true
      expect(subject[:default_language]).to eq 'fr'
      expect(subject[:display_own_boosts]).to be true
    end

    it 'does not set values that are nil' do
      expect(subject.as_json).to_not include(default_privacy: nil)
    end

    it 'routes virtual settings to their writers' do
      subject.update(flavour_and_skin: 'bird-ui/mastodon-bird-ui-auto')

      expect(subject['flavour']).to eq 'bird-ui'
      expect(subject['skin']).to eq 'mastodon-bird-ui-auto'
      expect(subject.as_json).to_not include(:flavour_and_skin)
    end
  end

  describe '#flavour_and_skin' do
    it 'joins the flavour and skin keys' do
      subject['flavour'] = 'bird-ui'
      subject['skin'] = 'mastodon-bird-ui-auto'

      expect(subject.flavour_and_skin).to eq 'bird-ui/mastodon-bird-ui-auto'
    end

    it 'selects Fanfou Classic for a stored Space Fanfou preference' do
      subject['flavour'] = 'mastodon-ui'
      subject['skin'] = 'space_fanfou'

      expect(subject.flavour_and_skin).to eq 'mastodon-ui/fanfou_classic'
    end
  end

  describe '#flavour_and_skin=' do
    it 'saves an old Space Fanfou form submission under the merged skin' do
      subject.flavour_and_skin = 'mastodon-ui/space_fanfou'

      expect(subject['skin']).to eq 'fanfou_classic'
    end

    it 'splits the pair onto the flavour and skin keys' do
      subject.flavour_and_skin = 'bird-ui/mastodon-bird-ui-auto'

      expect(subject['flavour']).to eq 'bird-ui'
      expect(subject['skin']).to eq 'mastodon-bird-ui-auto'
      expect(subject.as_json).to_not include(:flavour_and_skin)
    end

    it 'drops missing parts so they fall back to defaults' do
      subject.flavour_and_skin = 'bird-ui/'

      expect(subject['flavour']).to eq 'bird-ui'
      expect(subject.as_json).to_not have_key(:skin)
    end
  end

  describe '#as_json' do
    let(:json) { { default_language: 'fr' } }

    it 'returns hash' do
      expect(subject.as_json).to eq json
    end
  end

  describe '.keys' do
    it 'returns an array' do
      expect(described_class.keys).to be_a Array
    end
  end

  describe '.definition_for' do
    context 'when key is defined' do
      it 'returns a setting' do
        expect(described_class.definition_for(:always_send_emails)).to be_a described_class::Setting
      end
    end

    context 'when key is not defined' do
      it 'returns nil' do
        expect(described_class.definition_for(:foo)).to be_nil
      end
    end
  end

  describe '.definition_for?' do
    context 'when key is defined' do
      it 'returns true' do
        expect(described_class.definition_for?(:always_send_emails)).to be true
      end
    end

    context 'when key is not defined' do
      it 'returns false' do
        expect(described_class.definition_for?(:foo)).to be false
      end
    end
  end
end
