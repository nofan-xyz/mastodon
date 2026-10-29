# frozen_string_literal: true

require 'rails_helper'

RSpec.describe SharedCacheInvalidation do
  let(:first) { ActiveSupport::Cache::MemoryStore.new }
  let(:second) { ActiveSupport::Cache::MemoryStore.new }

  before do
    first.extend(described_class)
    first.shared_cache_peers = [second]
  end

  it 'keeps different serialized values until a logical entry is invalidated' do
    first.write(['relationships', 1, 2], 'old shape')
    second.write(['relationships', 1, 2], 'new shape')
    expect(first.read(['relationships', 1, 2])).to eq 'old shape'
    expect(second.read(['relationships', 1, 2])).to eq 'new shape'
    first.delete(['relationships', 1, 2])
    expect(first.read(['relationships', 1, 2])).to be_nil
    expect(second.read(['relationships', 1, 2])).to be_nil
  end

  it 'invalidates multiple entries without discarding unrelated data' do
    keys = %w(one two keep)
    [first, second].each do |store|
      keys.each { |key| store.write(key, key) }
    end
    first.delete_multi(%w(one two))
    expect(second.read_multi('one', 'two', 'keep')).to eq('keep' => 'keep')
  end

  it 'invalidates wildcard relationship entries in both stores' do
    [first, second].each do |store|
      store.write('relationships:1:2', true)
      store.write('keep', true)
    end
    first.delete_matched(/\Arelationships:/)
    expect(second.read('relationships:1:2')).to be_nil
    expect(second.read('keep')).to be true
  end
end
