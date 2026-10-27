"""Apply an accepted shared-data application release without database migrations."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

os.umask(0o077)
p = argparse.ArgumentParser()
p.add_argument('--acceptance', required=True)
a = p.parse_args()
lab = Path('/home/mastodon-shared-rehearsal')
acceptance = Path(a.acceptance).resolve()
assert acceptance.is_relative_to(lab / 'results')
accepted = json.loads(acceptance.read_text())
required = ['ci', 'typecheck', 'lint', 'ruby_tests', 'js_tests', 'built_ui',
            'header_matrix', 'select_matrix', 'rehearsal_http', 'rehearsal_media',
            'rehearsal_models', 'rehearsal_text', 'rehearsal_login_limits']
assert all(accepted['checks'].get(k) is True for k in required)
assert accepted['built_cases'] >= 48
source = accepted['source_commit']
assert len(source) == 40 and all(c in '0123456789abcdef' for c in source)
image, streaming = accepted['image'], accepted['streaming']
for value in [image, streaming]:
    assert value.startswith('ghcr.io/nofan-xyz/mastodon') and '@sha256:' in value
manifest = Path(accepted['manifest']).resolve()
assert manifest.is_relative_to(lab / 'results')
assert json.loads(manifest.read_text())['source_commit'] == source
subprocess.run(['docker', 'run', '--rm', '-v', str(manifest) + ':/overlay-manifest.json:ro',
                '-v', str(lab / 'tools/verify_overlay.rb') + ':/verify.rb:ro',
                '--entrypoint', 'bundle', image, 'exec', 'ruby', '/verify.rb'], check=True)
root = Path('/home/mastodon')
path = root / 'docker-compose.override.yml'
old = json.loads(path.read_text())
new = json.loads(path.read_text())
roles = ['web-beta', 'sidekiq', 'sidekiq-ingress', 'sidekiq-push']
assert all(old['services'][role]['image'] == accepted['previous_image'] for role in roles)
assert old['services']['streaming']['image'] == accepted['previous_streaming']
assert old['services']['web']['image'] == accepted['legacy_image']
assert old['services']['web']['environment']['CDN_HOST'] == ''
assert old['services']['web-beta']['environment']['NOFAN_SHARED_DATA'] == 'true'
run = root / 'shared-rollout' / (time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '-application')
run.mkdir(mode=0o700)
shutil.copyfile(path, run / 'before-compose.override.yml')
shutil.copyfile(root / 'shared-release.json', run / 'before-release.json')
shutil.copyfile(acceptance, run / 'acceptance.json')
for role in roles:
    new['services'][role]['image'] = image
new['services']['streaming']['image'] = streaming
(run / 'proposed-compose.override.yml').write_text(json.dumps(new, indent=2) + '\n')
started = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

def compose(*args):
    subprocess.run(['docker', 'compose', *args], cwd=root, check=True)

def healthy():
    try:
        for port in [3000, 3106]:
            with urllib.request.urlopen('http://127.0.0.1:' + str(port) + '/health', timeout=5) as response:
                if response.status != 200:
                    return False
        rows = subprocess.check_output(['docker', 'compose', 'ps', '--format', 'json'], cwd=root, text=True)
        services = [json.loads(line) for line in rows.splitlines() if line]
        return all(any(row['Service'] == role and row['Health'] == 'healthy' for row in services)
                   for role in [*roles, 'streaming'])
    except Exception:
        return False

try:
    path.write_text(json.dumps(new, indent=2) + '\n')
    compose('config', '--quiet')
    compose('run', '--rm', '-T', '--no-deps', 'web-beta', 'bundle', 'exec', 'rails', 'db:abort_if_pending_migrations')
    compose('stop', '-t', '90', 'sidekiq', 'sidekiq-ingress', 'sidekiq-push')
    compose('up', '-d', '--no-deps', *roles, 'streaming')
    deadline = time.time() + 240
    while time.time() < deadline:
        if healthy():
            break
        time.sleep(3)
    else:
        raise RuntimeError('Application health timeout')
    compose('exec', '-T', 'web-beta', 'bundle', 'exec', 'rails', 'runner',
            "%w(api/v1/instances/show api/v2/instances/show).each { |key| Rails.cache.delete(key) }")
    compose('exec', '-T', '--user', '0:0', 'web-beta', 'bundle', 'exec', 'rails', 'runner',
            '/opt/mastodon/deploy/shared/verify_production.rb')
    compose('exec', '-T', 'web-beta', 'bundle', 'exec', 'rails', 'runner',
            '/opt/mastodon/deploy/shared/verify_production_jobs.rb', started)
except Exception:
    shutil.copyfile(run / 'before-compose.override.yml', path)
    compose('config', '--quiet')
    compose('up', '-d', '--no-deps', *roles, 'streaming')
    print('Previous application configuration restored; live database retained', flush=True)
    raise
release = json.loads((root / 'shared-release.json').read_text())
release['new_image'] = image
release['streaming_image'] = streaming
receipt = {'at': started, 'from': accepted['previous_image'], 'to': image,
           'source_commit': source, 'streaming': streaming,
           'database_migrated': False, 'application_config_backup': str(run)}
release.setdefault('updates', []).append(receipt)
plan = Path((root / 'shared-rollout/current-plan').read_text().strip())
for target in [root / 'shared-release.json', plan / 'release.json', run / 'release.json']:
    target.write_text(json.dumps(release, indent=2) + '\n')
shutil.copyfile(path, plan / 'docker-compose.override.yml')
(run / 'deployed.json').write_text(json.dumps(receipt, indent=2) + '\n')
(root / 'shared-rollout/current-application-update').write_text(str(run) + '\n')
print('PASS application release; no migrations; previous configuration and images retained', flush=True)
