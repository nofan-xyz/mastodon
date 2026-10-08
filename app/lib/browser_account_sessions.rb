# frozen_string_literal: true

# Keep existing, revocable login sessions in an encrypted HttpOnly cookie.
# Account IDs alone must never be sufficient to authenticate a saved account.
class BrowserAccountSessions
  COOKIE_NAME = '_mastodon_accounts'
  LIMIT = 5

  def initialize(cookies)
    @cookies = cookies
  end

  def sessions
    ids = Array(@cookies.encrypted[COOKIE_NAME]).grep(String).first(LIMIT)
    indexed = SessionActivation.where(session_id: ids).includes(user: :account).index_by(&:session_id)
    ids.filter_map { |id| indexed[id] }.uniq(&:user_id)
  end

  def remember(activation)
    return unless activation

    write(([activation] + sessions).uniq(&:user_id).first(LIMIT))
  end

  def forget(session_id)
    write(sessions.reject { |activation| activation.session_id == session_id })
  end

  private

  def write(activations)
    @cookies.encrypted[COOKIE_NAME] = {
      value: activations.map(&:session_id),
      expires: 1.year.from_now,
      httponly: true,
      same_site: :lax,
    }
  end
end
