# frozen_string_literal: true

# Keep version-specific serialized values apart, but invalidate both copies when
# either Web or the shared workers invalidate a logical cache entry.
module SharedCacheInvalidation
  attr_accessor :shared_cache_peers

  def delete(name, **)
    result = super
    shared_cache_peers.each { |store| store.delete(name, **) }
    result
  end

  def delete_multi(names, **)
    result = super
    shared_cache_peers.each { |store| store.delete_multi(names, **) }
    result
  end

  def delete_matched(matcher, **)
    result = super
    shared_cache_peers.each { |store| store.delete_matched(matcher, **) }
    result
  end
end
