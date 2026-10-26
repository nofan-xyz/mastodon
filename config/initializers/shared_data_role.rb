# frozen_string_literal: true

# Legacy Web may enqueue jobs understood by the unified 5.0 consumers, but must
# not compete for queues containing new worker classes it cannot execute.
raise 'Shared data requires the 5.0 worker image; refusing to start a 4.7 consumer' if ENV['NOFAN_SHARED_DATA'] == 'true' && Sidekiq.server?
