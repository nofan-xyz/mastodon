# frozen_string_literal: true

class RemovePrivateKeyFromAccounts < ActiveRecord::Migration[8.1]
  def up
    return if ENV['NOFAN_SHARED_DATA'] == 'true'

    safety_assured { remove_column :accounts, :private_key, :text, null: true }
  end

  def down
    add_column :accounts, :private_key, :text, null: true unless column_exists?(:accounts, :private_key)
  end
end
