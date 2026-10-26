# frozen_string_literal: true

# General caches are version-specific; authentication throttles must not be.
if ENV['NOFAN_SHARED_DATA'] == 'true'
  Rack::Attack.cache.store = ActiveSupport::Cache::RedisCacheStore.new(
    REDIS_CONFIGURATION.base.merge(namespace: 'shared-rack-attack-v1')
  )
end
