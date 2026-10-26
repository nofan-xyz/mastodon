# frozen_string_literal: true

# Retain the old JSON representation during the coexistence/rollback window.
# Both supported Web versions read the new table; old JSON remains usable if the
# legacy Web image is restored. Lock the provider before reading all capabilities
# so concurrent capability updates cannot replace one another's mirror.
module SharedFaspCapabilities
  extend ActiveSupport::Concern

  included do
    before_save :lock_shared_fasp_provider
    before_destroy :lock_shared_fasp_provider
    after_save :mirror_legacy_fasp_capabilities
    after_destroy :mirror_legacy_fasp_capabilities
  end

  private

  def lock_shared_fasp_provider
    return unless ENV['NOFAN_SHARED_DATA'] == 'true'

    Fasp::Provider.where(id: fasp_provider_id).lock.pick(:id)
  end

  def mirror_legacy_fasp_capabilities
    return unless ENV['NOFAN_SHARED_DATA'] == 'true' && Fasp::Provider.column_names.include?('capabilities')

    provider = Fasp::Provider.lock.find_by(id: fasp_provider_id)
    return if provider.nil?

    values = Fasp::Capability.where(fasp_provider_id:).order(:name, :version).pluck(:name, :version, :enabled)
    provider.update_columns(capabilities: values.map { |name, version, enabled| { id: name, version:, enabled: } })
  end
end
