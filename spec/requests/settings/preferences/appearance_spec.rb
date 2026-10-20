# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Settings Preferences Appearance' do
  describe 'PUT /settings/preferences/appearance' do
    let(:user) { Fabricate(:user) }

    before { sign_in user }

    it 'preserves the merged theme when an old form submits Space Fanfou' do
      put settings_preferences_appearance_path, params: { user: { settings_attributes: { flavour_and_skin: 'mastodon-ui/space_fanfou' } } }

      expect(response).to redirect_to(settings_preferences_appearance_path)
      expect(user.reload.settings['skin']).to eq('fanfou_classic')
    end

    it 'gracefully handles invalid nested params' do
      put settings_preferences_appearance_path(user: 'invalid')

      expect(response)
        .to have_http_status(400)
    end
  end

  describe 'GET /settings/preferences/appearance' do
    it 'selects the merged skin for an existing Space Fanfou preference' do
      user = Fabricate(:user)
      user.settings.update(flavour: 'mastodon-ui', skin: 'space_fanfou')
      user.save!
      sign_in user

      get settings_preferences_appearance_path

      page = response.parsed_body
      selector = page.at_css('#user_settings_attributes_flavour_and_skin')
      expect(selector.at_css('option[selected]')['value']).to eq('mastodon-ui/fanfou_classic')
      expect(selector.css('option').pluck('value')).to_not include('mastodon-ui/space_fanfou')
    end
  end
end
