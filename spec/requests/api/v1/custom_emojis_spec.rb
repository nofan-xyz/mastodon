# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Custom Emojis' do
  include_context 'with API authentication'

  describe 'GET /api/v1/custom_emojis' do
    before do
      category = Fabricate(:custom_emoji_category)
      Fabricate(:custom_emoji, domain: nil, disabled: false, visible_in_picker: true, shortcode: 'coolcat', category: category)
      Wxw::EmojiPack.create!(custom_emoji_category: category, name: 'coolcat_pack', default_enabled: true)
    end

    context 'when logged out' do
      it 'returns http success and json' do
        get api_v1_custom_emojis_path

        expect(response)
          .to have_http_status(200)
        expect(response.content_type)
          .to start_with('application/json')

        expect(response.parsed_body)
          .to be_present
          .and have_attributes(
            first: include(shortcode: 'coolcat')
          )
      end
    end

    context 'when logged in' do
      it 'returns http success and json' do
        get api_v1_custom_emojis_path, headers: headers

        expect(response)
          .to have_http_status(200)
        expect(response.content_type)
          .to start_with('application/json')

        expect(response.parsed_body)
          .to be_present
          .and have_attributes(
            first: include(shortcode: 'coolcat')
          )
      end
    end

    context 'with personal pack visibility and order' do
      let!(:alpha_pack) do
        category = Fabricate(:custom_emoji_category)
        Fabricate(:custom_emoji, shortcode: 'alpha_emoji', category: category)
        Wxw::EmojiPack.create!(custom_emoji_category: category, name: 'Alpha')
      end
      let!(:zebra_pack) do
        category = Fabricate(:custom_emoji_category)
        Fabricate(:custom_emoji, shortcode: 'zebra_emoji', category: category)
        Wxw::EmojiPack.create!(custom_emoji_category: category, name: 'Zebra')
      end

      before do
        user.settings[Wxw::EmojiPack::PICKS_KEY] = Wxw::EmojiPack.dump_ids([alpha_pack.id, zebra_pack.id])
        user.settings[Wxw::EmojiPack::ORDER_KEY] = Wxw::EmojiPack.dump_ids([zebra_pack.id, alpha_pack.id])
        user.settings[Wxw::EmojiPack::NUMBERED_KEY] = false
        user.settings_will_change!
        user.save!
      end

      it 'exposes only selected packs with an order independent of their labels' do
        get api_v1_custom_emojis_path, headers: headers

        expect(response.parsed_body.pluck('shortcode')).to eq(%w(zebra_emoji alpha_emoji))
        expect(response.parsed_body.pluck('category')).to eq(%w(Zebra Alpha))
        expect(response.parsed_body.pluck('category_order')).to eq([0, 1])
      end

      it 'keeps the saved order with numbered labels' do
        user.settings[Wxw::EmojiPack::NUMBERED_KEY] = true
        user.settings_will_change!
        user.save!

        get api_v1_custom_emojis_path, headers: headers

        expect(response.parsed_body.pluck('category')).to eq(['1. Zebra', '2. Alpha'])
        expect(response.parsed_body.pluck('category_order')).to eq([0, 1])
      end

      it 'returns no custom emojis when all packs are hidden' do
        user.settings[Wxw::EmojiPack::PICKS_KEY] = '[]'
        user.settings_will_change!
        user.save!

        get api_v1_custom_emojis_path, headers: headers

        expect(response.parsed_body).to eq([])
      end
    end
    context 'when the emoji is not in any published pack' do
      before do
        Fabricate(:custom_emoji, domain: nil, disabled: false, visible_in_picker: true, shortcode: 'lonelycat')
      end

      it 'is not included in the response' do
        get api_v1_custom_emojis_path

        expect(response.parsed_body.pluck('shortcode'))
          .to contain_exactly('coolcat')
      end
    end
  end
end
