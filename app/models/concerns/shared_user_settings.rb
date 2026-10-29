# frozen_string_literal: true

# Both Web versions save the same serialized settings column. Merge only the
# caller's changed keys while holding the user row lock, preserving newer keys
# written by another Web process after this object was loaded.
module SharedUserSettings
  extend ActiveSupport::Concern

  included do
    before_update :merge_shared_user_settings, if: :shared_user_settings_changed?
  end

  private

  def shared_user_settings_changed?
    ENV['NOFAN_SHARED_DATA'] == 'true' && will_save_change_to_settings?
  end

  def merge_shared_user_settings
    previous, incoming = attribute_change_to_be_saved('settings')
    previous = previous&.as_json || {}
    incoming = incoming&.as_json || {}
    changed_keys = (previous.keys | incoming.keys).select do |key|
      previous.key?(key) != incoming.key?(key) || previous[key] != incoming[key]
    end

    latest = self.class.unscoped.select(:id, :settings).lock.find(id).settings.as_json.dup
    changed_keys.each do |key|
      if incoming.key?(key)
        latest[key] = incoming[key]
      else
        latest.delete(key)
      end
    end

    self.settings = UserSettings.new(latest)
  end
end
