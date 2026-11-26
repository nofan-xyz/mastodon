# frozen_string_literal: true

require 'uri'

class SharedWebOrigins
  ROOT_PATHS = ['', '/'].freeze

  def self.for(canonical_domain, additional_origins)
    allowed = ["https://#{canonical_domain}"]

    additional_origins.split(',').map(&:strip).reject(&:empty?).each do |value|
      uri = URI.parse(value)
      valid_host = uri.host == canonical_domain || uri.host&.end_with?(".#{canonical_domain}")
      valid = uri.scheme == 'https' && valid_host && uri.port == 443 && uri.userinfo.nil? && uri.query.nil? && uri.fragment.nil? && ROOT_PATHS.include?(uri.path)
      raise ArgumentError, 'Shared WebAuthn origins must be HTTPS origins under the canonical domain' unless valid

      allowed << "https://#{uri.host}"
    end

    allowed.uniq
  end
end
