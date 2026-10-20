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

    within('nav') do
      click_on frontend_translations('tabs_bar.publish')
    end

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

    format_button_label = frontend_translations('compose.content-type.change')
    format_button = nil

    within('.compose-form') do
      format_button = find_button(format_button_label)
      format_button.click
    end

    expect(format_button['aria-expanded']).to eq 'true'

    find('[role="option"]', text: frontend_translations('compose.content-type.markdown')).click

    expect(format_button['aria-expanded']).to eq 'false'
    expect(page.evaluate_script("document.activeElement?.getAttribute('aria-label')")).to eq format_button_label

    within('.compose-form') do
      fill_in frontend_translations('compose_form.placeholder'), with: '**Markdown**'
      click_on 'Post'
    end

    expect(page)
      .to have_css('.status__content__text strong', text: 'Markdown')
    expect(bob.account.statuses.first.content_type)
      .to eq('text/markdown')
  end

  def visit_homepage
    visit root_path

    expect(page)
      .to have_css('div.app-holder')
  end
end
