# frozen_string_literal: true

require 'json'
require 'digest'

manifest = JSON.parse(File.read('/overlay-manifest.json'))
manifest.fetch('files').each do |path, expected|
  raise "Overlay mismatch: #{path}" unless Digest::SHA256.file("/opt/mastodon/#{path}").hexdigest == expected
end
raise 'Revision mismatch' unless ENV.fetch('SOURCE_COMMIT') == manifest.fetch('source_commit')

versions = %w(linzer crass pghero).to_h { |name| [name, Gem.loaded_specs.fetch(name).version.to_s] }
raise 'Unexpected compatibility dependencies' unless versions == { 'linzer' => '0.8.1', 'crass' => '1.0.8', 'pghero' => '4.1.0' }

puts JSON.generate(verified_files: manifest.fetch('files').size, revision: manifest.fetch('source_commit'), gems: versions)
