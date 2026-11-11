# frozen_string_literal: true

require 'aws-sdk-s3'
require 'json'
require 'uri'
source = ENV.fetch('SNAPSHOT_SOURCE_BUCKET')
target = ENV.fetch('S3_BUCKET')
abort 'Bucket guard failed' unless source == 'nofan-box' && target == 'beta-nofan-box'
client = Aws::S3::Client.new(region: ENV.fetch('S3_REGION'), endpoint: ENV.fetch('S3_ENDPOINT'), force_path_style: true, retry_limit: 4, http_read_timeout: 120)
abort 'Region guard failed' unless client.get_bucket_location(bucket: target).location_constraint == 'eu-central-2'
root = '/snapshot'
state_path = "#{root}/media-progress.json"
state = File.exist?(state_path) ? JSON.parse(File.read(state_path)) : { 'copied' => 0, 'bytes' => 0, 'errors' => 0, 'prefix_index' => 0, 'token' => nil, 'started_at' => Time.now.utc.to_s }
prefixes = client.list_objects_v2(bucket: source, delimiter: '/').common_prefixes.map(&:prefix).sort_by { |p| [p.start_with?('cache/') ? 1 : 0, p] }
prefixes = [''] + prefixes # empty prefix pass handles only root keys, with delimiter.
prefixes.each_with_index do |prefix, idx|
  next if idx < state['prefix_index']

  token = idx == state['prefix_index'] ? state['token'] : nil
  loop do
    args = { bucket: source, prefix: prefix, max_keys: 1000, continuation_token: token }
    args[:delimiter] = '/' if prefix.empty?
    page = client.list_objects_v2(**args)
    File.open("#{root}/media-manifest.jsonl", 'a', 0o600) { |f| page.contents.each { |o| f.puts({ key: o.key, size: o.size, etag: o.etag, last_modified: o.last_modified }.to_json) } }
    queue = Queue.new
    page.contents.each { |o| queue << o }
    results = Queue.new
    Array.new(32) do
      Thread.new do
        loop do
          begin; o = queue.pop(true); rescue ThreadError; break; end
          begin
            encoded = URI::DEFAULT_PARSER.escape("#{source}/#{o.key}", %r{[^a-zA-Z0-9\-_.~/]})
            client.copy_object(bucket: target, key: o.key, copy_source: encoded, copy_source_if_match: o.etag, metadata_directive: 'COPY', acl: 'public-read')
            results << [o.size, nil]
          rescue => e
            results << [0, { key: o.key, error: e.class.name, message: e.message.to_s[0, 160] }]
          end
        end
      end
    end.each(&:join)
    until results.empty?
      size, error = results.pop
      if error
        state['errors'] += 1
        File.open("#{root}/media-errors.jsonl", 'a', 0o600) { |f| f.puts(error.to_json) }
      else
        state['copied'] += 1
        state['bytes'] += size
      end
    end
    token = page.next_continuation_token
    state.merge!('prefix' => prefix, 'prefix_index' => idx, 'token' => token, 'updated_at' => Time.now.utc.to_s)
    File.write("#{state_path}.tmp", JSON.pretty_generate(state))
    File.rename("#{state_path}.tmp", state_path)
    puts JSON.generate(state)
    $stdout.flush
    break unless page.is_truncated
  end
  state['prefix_index'] = idx + 1
  state['token'] = nil
  File.write(state_path, JSON.pretty_generate(state))
end
state['finished_at'] = Time.now.utc.to_s
File.write(state_path, JSON.pretty_generate(state))
abort 'Media copy contains errors; inspect protected error log' if state['errors'].positive?
File.write("#{root}/media.done", Time.now.utc.to_s)
