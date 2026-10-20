# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'NewStatuses', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:status_text) { 'This is a new status!' }

  before { as_a_logged_in_user }

  it 'can be posted' do
    visit_homepage

    open_compose_form

    within('form[role="dialog"]') do
      fill_in frontend_translations('compose.post.placeholder'), with: status_text
      click_on frontend_translations('compose.publish')
    end

    expect(page)
      .to have_css('article[data-id]', text: status_text)
  end

  it 'can be posted using Markdown' do
    bob.settings[:show_content_type_choice] = true
    bob.save!
    visit_homepage

    open_compose_form

    format_button_label = frontend_translations('compose.content-type.change')
    format_button = open_format_menu

    expect(format_button['aria-label']).to eq format_button_label
    expect(format_button['aria-expanded']).to eq 'true'

    find('[role="menuitemradio"]', text: frontend_translations('compose.content-type.markdown')).click

    expect(page).to have_no_css('[role="menu"]')
    expect(format_button['aria-expanded']).to eq 'false'
    expect(page.evaluate_script("document.activeElement?.getAttribute('aria-label')")).to eq format_button_label

    within('form[role="dialog"]') do
      fill_in frontend_translations('compose.post.placeholder'), with: '**Markdown**'
      click_on frontend_translations('compose.publish')
    end

    expect(page)
      .to have_css('article[data-id] strong', text: 'Markdown')
    expect(bob.account.statuses.first.content_type)
      .to eq('text/markdown')
  end

  def open_compose_form
    within('nav') { click_on frontend_translations('tabs_bar.publish') }
  end

  def open_format_menu
    button = find('form[role="dialog"]').find_button(frontend_translations('compose.content-type.plain'))
    button.click
    button
  end

  def visit_homepage
    visit root_path

    expect(page)
      .to have_css('div.app-holder')
  end
end
