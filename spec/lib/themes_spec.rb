# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Themes do
  subject(:themes) { described_class.instance }

  describe '#flavours' do
    it 'lists the default flavour first, the rest alphabetically' do
      expect(themes.flavours).to eq(%w(mastodon-ui bird-ui tangerine-ui))
    end
  end

  describe '#flavour' do
    it 'exposes the pack directory' do
      expect(themes.flavour('mastodon-ui'))
        .to include('pack_directory' => 'app/javascript/entrypoints')
    end

    it 'returns nil for unknown flavours' do
      expect(themes.flavour('nonexistent')).to be_nil
    end
  end

  describe '#skins_for' do
    it 'lists the default skin first, the rest alphabetically' do
      expect(themes.skins_for('mastodon-ui')).to eq(
        %w(default fanfou_classic graphite sakura vermilion_seal)
      )
    end

    it 'lists the primary bird-ui skin first' do
      expect(themes.skins_for('bird-ui')).to eq(%w(mastodon-bird-ui-auto sakura))
    end

    it 'lists the tangerine-ui flavour skins with the flagship variant first' do
      expect(themes.skins_for('tangerine-ui')).to eq(
        %w(tangerine cherry granite lagoon purple)
      )
    end

    it 'returns an empty list for unknown flavours' do
      expect(themes.skins_for('nonexistent')).to eq([])
    end
  end

  describe '#all_skins' do
    it 'unions skins across flavours' do
      expect(themes.all_skins).to include('default', 'graphite', 'fanfou_classic', 'tangerine', 'sakura')
    end
  end

  describe '#flavours_and_skins' do
    it 'pairs each skin with its flavour for grouped selects' do
      grouped = themes.flavours_and_skins.to_h

      expect(grouped['bird-ui']).to eq(
        [%w(bird-ui mastodon-bird-ui-auto), %w(bird-ui sakura)]
      )
      expect(grouped['mastodon-ui'].map(&:last)).to eq(
        %w(default fanfou_classic graphite sakura vermilion_seal)
      )
      expect(grouped['tangerine-ui'].map(&:last)).to eq(
        %w(tangerine cherry granite lagoon purple)
      )
    end
  end

  describe '#available_theme_colors' do
    it 'supports the stored flavour and skin pair used by the appearance page' do
      expect(themes.available_theme_colors(%w(mastodon-ui default)))
        .to eq(themes.available_theme_colors('default'))
        .and include('indigo', 'pink')
    end

    it 'does not add an accent palette to a custom skin' do
      expect(themes.available_theme_colors(%w(bird-ui sakura))).to be_empty
    end
  end

  describe '#canonical_skin' do
    it 'resolves the retired Space Fanfou preference to Fanfou Classic' do
      expect(themes.canonical_skin('mastodon-ui', 'space_fanfou')).to eq('fanfou_classic')
    end

    it 'does not rewrite another flavour or an unknown preference' do
      expect(themes.canonical_skin('bird-ui', 'space_fanfou')).to eq('space_fanfou')
      expect(themes.canonical_skin('mastodon-ui', 'unknown')).to eq('unknown')
    end
  end
end
