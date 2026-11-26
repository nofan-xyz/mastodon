"""Configure only the private rehearsal project, never production or beta."""
from pathlib import Path
import json
import os
import shutil
import subprocess

os.umask(0o077)
root = Path('/home/mastodon-shared-rehearsal')
assert (root / 'results/restore.done').is_file(), 'Wait for the independent restore'
assert (root / 'compose.yml').is_file()
env_file = root / '.env.production'
env = dict(line.split('=', 1) for line in env_file.read_text().splitlines() if '=' in line)
assert env['DB_NAME'] == 'mastodon_shared_rehearsal' and env['S3_BUCKET'] == 'beta-nofan-box'
for key in list(env):
    if key.startswith('REPLICA_DB_') or key in {'DATABASE_URL', 'SIDEKIQ_REDIS_HOST', 'SIDEKIQ_REDIS_PASSWORD', 'SIDEKIQ_REDIS_USER', 'CACHE_REDIS_HOST', 'CACHE_REDIS_PASSWORD', 'CACHE_REDIS_USER', 'CDN_HOST'}:
        del env[key]
env.update(SIDEKIQ_REDIS_URL='redis://redis:6379/0', NOFAN_SHARED_WEB_ORIGINS='https://beta.nofan.xyz', RAILS_LOG_LEVEL='warn', NOFAN_SHARED_CACHE_REDIS_URLS='redis://redis:6379/1,redis://redis:6379/2')
env_file.write_text(''.join(f'{key}={value}\n' for key, value in env.items()))
shutil.copyfile('/tmp/rehearsal_isolation.rb', root / 'rehearsal_isolation.rb')
shutil.copyfile('/tmp/rehearsal_sidekiq.yml', root / 'rehearsal_sidekiq.yml')
os.chmod(root / 'rehearsal_isolation.rb', 0o644)
os.chmod(root / 'rehearsal_sidekiq.yml', 0o644)
streaming = json.loads((Path('/home/mastodon-beta') / 'release.json').read_text())['STREAMING_IMAGE']
with (root / '.env').open('a') as handle:
    handle.write('STREAMING_IMAGE=' + streaming + '\n')
(root / 'compose.override.yml').write_text('''services:
  web47:
    image: ${PATCHED_IMAGE47:?Build legacy patch image first}
    env_file: .env.production
    environment:
      CACHE_REDIS_URL: redis://redis:6379/1
      CDN_HOST: https://nofan.xyz
    command: bundle exec puma -C config/puma.rb
    ports: ['127.0.0.1:3204:3000']
    volumes:
      - ./rehearsal_isolation.rb:/opt/mastodon/config/initializers/zz_rehearsal_isolation.rb:ro
    networks: [internal, external]
  web50:
    image: ${PATCHED_IMAGE50:?Build new patch image first}
    env_file: .env.production
    environment:
      CACHE_REDIS_URL: redis://redis:6379/2
      CDN_HOST: https://beta.nofan.xyz
    command: bundle exec puma -C config/puma.rb
    ports: ['127.0.0.1:3205:3000']
    volumes:
      - ./rehearsal_isolation.rb:/opt/mastodon/config/initializers/zz_rehearsal_isolation.rb:ro
    networks: [internal, external]
  worker50:
    image: ${PATCHED_IMAGE50:?Build new patch image first}
    env_file: .env.production
    environment:
      CACHE_REDIS_URL: redis://redis:6379/2
      CDN_HOST: https://beta.nofan.xyz
    command: bundle exec sidekiq -C /rehearsal_sidekiq.yml
    volumes:
      - ./rehearsal_isolation.rb:/opt/mastodon/config/initializers/zz_rehearsal_isolation.rb:ro
      - ./rehearsal_sidekiq.yml:/rehearsal_sidekiq.yml:ro
    networks: [internal, external]
  streaming:
    image: ${STREAMING_IMAGE}
    env_file: .env.production
    environment:
      NODE_ENV: production
      PORT: '4000'
    ports: ['127.0.0.1:4205:4000']
    volumes:
      - ./results:/results:ro
      - ./tools:/tools:ro
    networks: [internal, external]
''')
print('Prepared loopback-only Web 4.7/5.0 and one 5.0 consumer; replica and Redis URLs are isolated')
