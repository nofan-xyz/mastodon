# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Fasp::Capability do
  around { |example| ClimateControl.modify(NOFAN_SHARED_DATA: 'true') { example.run } }

  before do
    ActiveRecord::Base.connection.add_column(:fasp_providers, :capabilities, :jsonb, default: [], null: false)
    Fasp::Provider.reset_column_information
    allow(Fasp::Request).to receive(:new).and_return(instance_double(Fasp::Request, post: nil, delete: nil))
  end

  after { Fasp::Provider.reset_column_information }

  let(:provider) { Fabricate(:fasp_provider) }

  it 'mirrors creation and activation into the retained legacy JSON column' do
    capability = Fabricate(:fasp_capability, fasp_provider: provider, name: 'discovery', version: '0.1')
    expect(provider.reload[:capabilities]).to include('id' => 'discovery', 'version' => '0.1', 'enabled' => false)

    capability.update!(enabled: true)

    expect(provider.reload[:capabilities]).to include('id' => 'discovery', 'version' => '0.1', 'enabled' => true)
  end

  it 'keeps other capabilities when one capability is removed' do
    first = Fabricate(:fasp_capability, fasp_provider: provider, name: 'first', enabled: true)
    Fabricate(:fasp_capability, fasp_provider: provider, name: 'second', enabled: true)

    first.destroy!

    expect(provider.reload[:capabilities].pluck('id')).to eq ['second']
  end
end
