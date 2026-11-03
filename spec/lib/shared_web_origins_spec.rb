# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SharedWebOrigins do
  it 'allows only explicitly configured HTTPS origins under the original account domain' do
    expect(described_class.for('nofan.xyz', 'https://beta.nofan.xyz')).to eq ['https://nofan.xyz', 'https://beta.nofan.xyz']
  end

  it 'does not add all subdomains implicitly' do
    expect(described_class.for('nofan.xyz', '')).to eq ['https://nofan.xyz']
  end

  it 'rejects unrelated domains and deceptive suffixes' do
    ['https://evil.test', 'https://evilnofan.xyz', 'https://nofan.xyz.evil.test'].each do |origin|
      expect { described_class.for('nofan.xyz', origin) }.to raise_error ArgumentError
    end
  end

  it 'rejects insecure origins, credentials, paths and nonstandard ports' do
    ['http://beta.nofan.xyz', 'https://user@beta.nofan.xyz', 'https://beta.nofan.xyz/path', 'https://beta.nofan.xyz:444', 'https://beta.nofan.xyz/?x=1'].each do |origin|
      expect { described_class.for('nofan.xyz', origin) }.to raise_error ArgumentError
    end
  end
end
