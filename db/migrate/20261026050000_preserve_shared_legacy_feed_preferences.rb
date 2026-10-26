# frozen_string_literal: true

class PreserveSharedLegacyFeedPreferences < ActiveRecord::Migration[8.1]
  def up
    return unless ENV['NOFAN_SHARED_DATA'] == 'true'

    # Legacy 4.7 always included own boosts. Preserve that existing behavior when
    # 5.0 starts owning the shared feed, without replacing any explicit choice.
    safety_assured do
      execute <<~SQL.squish
        UPDATE users
        SET settings = jsonb_set(COALESCE(NULLIF(settings, ''), '{}')::jsonb,
                                 '{display_own_boosts}', 'true'::jsonb)::text
        WHERE NOT COALESCE(NULLIF(settings, ''), '{}')::jsonb ? 'display_own_boosts'
      SQL
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Do not remove a user preference that may have been edited after cutover'
  end
end
