# frozen_string_literal: true

if ENV['NOFAN_SHARED_DATA'] == 'true'
  require_relative '../../app/lib/shared_cache_invalidation'

  urls = ENV.fetch('NOFAN_SHARED_CACHE_REDIS_URLS').split(',').map(&:strip).reject(&:empty?).uniq
  raise 'Configure both version cache URLs for shared data' if urls.size < 2

  Rails.application.config.after_initialize do
    store = Rails.cache
    raise 'Shared data requires a Redis Rails cache' unless store.is_a?(ActiveSupport::Cache::RedisCacheStore)

    store.extend(SharedCacheInvalidation)
    store.shared_cache_peers = urls.map do |url|
      ActiveSupport::Cache::RedisCacheStore.new(**REDIS_CONFIGURATION.cache.merge(url:))
    end
  end
end
