# frozen_string_literal: true

# Retain the old JSON representation during the coexistence/rollback window.
# Both supported Web versions read the new table; old JSON remains usable if the
# legacy Web image is restored. Lock the provider before reading all capabilities
# so concurrent capability updates cannot replace one another's mirror.
module SharedFaspCapabilities
  extend ActiveSupport::Concern

  included do
    after_save :mirror_legacy_fasp_capabilities
    after_destroy :mirror_legacy_fasp_capabilities
  end

  private

  def mirror_legacy_fasp_capabilities
    return unless ENV['NOFAN_SHARED_DATA'] == 'true' && Fasp::Provider.column_names.include?('capabilities')

    provider = Fasp::Provider.lock.find_by(id: fasp_provider_id)
    return if provider.nil?

    values = Fasp::Capability.where(fasp_provider_id:).order(:name, :version).pluck(:name, :version, :enabled)
    provider.update_columns(capabilities: values.map { |name, version, enabled| { id: name, version:, enabled: } })
  end
end
