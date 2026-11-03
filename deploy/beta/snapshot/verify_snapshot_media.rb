# frozen_string_literal: true

require 'aws-sdk-s3'
require 'json'
require 'net/http'
require 'uri'

raise 'Wrong destination' unless ENV['S3_BUCKET'] == 'beta-nofan-box' && ENV['S3_ALIAS_HOST'] == 'media.nofan.xyz/beta-nofan-box'

client = Aws::S3::Client.new(region: ENV.fetch('S3_REGION'), endpoint: ENV.fetch('S3_ENDPOINT'), force_path_style: true, retry_limit: 3)
samples = {}
File.foreach('/snapshot/media-manifest.jsonl') do |line|
  item = JSON.parse(line)
  prefix = item.fetch('key').split('/').first
  next unless %w(accounts custom_emojis media_attachments).include?(prefix)

  samples[prefix] ||= []
  samples[prefix] << item if samples[prefix].size < 5
  break if samples.size == 3 && samples.values.all? { |items| items.size == 5 }
end

raise 'Insufficient copied-media sample' unless samples.size == 3

samples.values.flatten.each do |item|
  object = client.head_object(bucket: 'beta-nofan-box', key: item.fetch('key'))
  raise 'Copied object mismatch' unless object.etag == item.fetch('etag') && object.content_length == item.fetch('size')

  encoded = URI::DEFAULT_PARSER.escape(item.fetch('key'), %r{[^a-zA-Z0-9\-_.~/]})
  uri = URI("https://media.nofan.xyz/beta-nofan-box/#{encoded}")
  response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 10, read_timeout: 20) { |http| http.head(uri.request_uri) }
  raise "Public media returned #{response.code}" unless response.is_a?(Net::HTTPSuccess)
end
puts JSON.generate(media_sample: 'passed', objects: samples.values.flatten.size, checks: 'ETag, byte length, anonymous CDN HEAD', scope: 'sample only; full-copy completion is tracked by media.done')
