# frozen_string_literal: true

# Coexistence intentionally retains legacy columns outside the canonical 5.0
# schema dump. Discover the live schema instead of trusting an image-time dump.
Rails.application.config.active_record.use_schema_cache_dump = false if ENV['NOFAN_SHARED_DATA'] == 'true'
