# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'OnThisDay' do
  include_context 'with API authentication'

  describe 'GET /api/v1/on_this_day/state' do
    context 'when not authorized' do
      it 'returns http unauthorized' do
        get '/api/v1/on_this_day/state'

        expect(response).to have_http_status(401)
      end
    end

    context 'with wrong scope' do
      before do
        get '/api/v1/on_this_day/state', headers: headers
      end

      it_behaves_like 'forbidden for wrong scope', 'write'
    end

    context 'when the feature is disabled in user settings' do
      let(:scopes) { 'read' }

      before do
        user.settings['on_this_day_enabled'] = false
        user.save!
      end

      it 'returns the disabled state instead of an error' do
        get '/api/v1/on_this_day/state', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body)
          .to include(state: 'disabled', date: OnThisDay.today_cst.to_s)
      end
    end

    context 'when the feature is enabled' do
      let(:scopes) { 'read' }

      it 'enqueues record generation and returns the pending state when no record exists' do
        expect { get '/api/v1/on_this_day/state', headers: headers }
          .to not_change(OnThisDayRecord, :count)

        expect(GenerateOnThisDayWorker)
          .to have_enqueued_sidekiq_job(user.account_id, OnThisDay.today_cst.iso8601)
        expect(response).to have_http_status(200)
        expect(response.parsed_body)
          .to include(state: 'pending', date: OnThisDay.today_cst.to_s)
      end

      it 'does not enqueue generation again when a record already exists' do
        Fabricate(:on_this_day_record, account: user.account)

        get '/api/v1/on_this_day/state', headers: headers

        expect(GenerateOnThisDayWorker)
          .to_not have_enqueued_sidekiq_job
      end

      it 'returns the ready state when a record with statuses exists' do
        status = Fabricate(:status, account: user.account)
        Fabricate(:on_this_day_record, account: user.account, data: { 'years' => { '2025' => [status.id.to_s] } })

        get '/api/v1/on_this_day/state', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body[:state]).to eq 'ready'
      end
    end
  end

  describe 'GET /api/v1/on_this_day' do
    let(:scopes) { 'read' }

    context 'when not authorized' do
      it 'returns http unauthorized' do
        get '/api/v1/on_this_day'

        expect(response).to have_http_status(401)
      end
    end

    context 'when the feature is disabled in user settings' do
      before do
        user.settings['on_this_day_enabled'] = false
        user.save!
      end

      it 'returns http forbidden' do
        get '/api/v1/on_this_day', headers: headers

        expect(response).to have_http_status(403)
        expect(response.parsed_body[:error]).to eq 'Feature not enabled'
      end
    end

    context 'when no record exists for today' do
      it 'returns http not found' do
        get '/api/v1/on_this_day', headers: headers

        expect(response).to have_http_status(404)
      end
    end

    context 'when the record for today has no statuses' do
      before do
        Fabricate(:on_this_day_record, account: user.account)
      end

      it 'returns an empty result' do
        get '/api/v1/on_this_day', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body).to include(data: { years: {} }, statuses: [])
      end
    end

    context 'when a record with statuses exists' do
      it 'returns the record with hydrated statuses and account' do
        status = Fabricate(:status, account: user.account, text: 'hello from the past')
        Fabricate(:on_this_day_record, account: user.account, data: { 'years' => { '2025' => [status.id.to_s] } })

        get '/api/v1/on_this_day', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body[:date]).to eq OnThisDay.today_cst.to_s
        expect(response.parsed_body[:statuses].pluck(:id)).to eq [status.id.to_s]
        expect(response.parsed_body[:accounts].pluck(:id)).to eq [user.account.id.to_s]
      end

      it 'filters posts deleted or made direct after precomputation out of both IDs and statuses' do
        visible = Fabricate(:status, account: user.account)
        deleted = Fabricate(:status, account: user.account)
        direct = Fabricate(:status, account: user.account)
        foreign = Fabricate(:status)
        Fabricate(:on_this_day_record, account: user.account, data: { 'years' => { '2025' => [visible, deleted, direct, foreign].map { |status| status.id.to_s } } })
        deleted.discard
        direct.update!(visibility: :direct)

        get '/api/v1/on_this_day', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body[:statuses].pluck(:id)).to eq [visible.id.to_s]
        expect(response.parsed_body[:data][:years].values.flatten).to eq [visible.id.to_s]
      end
    end

    it 'does not expose a precomputed record before its Beijing date' do
      travel_to Time.utc(2026, 10, 15, 15, 30) do
        Fabricate(:on_this_day_record, account: user.account, date: Date.new(2026, 10, 16))

        get '/api/v1/on_this_day', headers: headers

        expect(response).to have_http_status(404)
      end
    end
  end
end
