# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin Settings Appearance' do
  before { sign_in Fabricate(:admin_user) }

  it 'renders the flavour selector with its dynamic color metadata' do
    get admin_settings_appearance_path

    expect(response).to have_http_status(200)
    selector = response.parsed_body.at_css('#form_admin_settings_flavour_and_skin')
    expect(selector).to be_present
    expect(JSON.parse(selector['data-theme-colors'])).to have_key('mastodon-ui/default')
  end

  it 'saves site colors together with an existing flavour and skin' do
    put admin_settings_appearance_path, params: { form_admin_settings: { flavour_and_skin: 'mastodon-ui/default', theme_color: 'orange' } }

    expect(response).to redirect_to(admin_settings_appearance_path)
    expect(Setting.flavour).to eq('mastodon-ui')
    expect(Setting.skin).to eq('default')
    expect(Setting.theme_color).to eq('orange')
  end
end
