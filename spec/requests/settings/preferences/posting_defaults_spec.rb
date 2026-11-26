# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Settings Preferences Posting Defaults' do
  let(:user) { Fabricate(:user) }

  before { sign_in user }

  it 'renders supported posting settings without the removed spoiler default' do
    get settings_preferences_posting_defaults_path

    expect(response).to have_http_status(200)
    expect(response.parsed_body.at_css('input[name="user[settings_attributes][default_content_type]"]')).to be_present
    expect(response.parsed_body.at_css('input[name="user[settings_attributes][show_content_type_choice]"]')).to be_present
    expect(response.parsed_body.at_css('[name="user[settings_attributes][default_spoiler_field]"]')).to be_nil
  end

  it 'saves posting defaults and renders the updated form' do
    put settings_preferences_posting_defaults_path, params: {
      user: { settings_attributes: { default_content_type: 'text/markdown', show_content_type_choice: '0', default_sensitive: '1' } },
    }

    expect(response).to redirect_to(settings_preferences_posting_defaults_path)
    expect(user.reload.settings.default_content_type).to eq('text/markdown')
    expect(user.settings.show_content_type_choice).to be(false)
    expect(user.settings.default_sensitive).to be(true)

    follow_redirect!

    expect(response).to have_http_status(200)
    expect(response.parsed_body.at_css('input[value="text/markdown"]')).to have_attribute('checked')
  end
end
