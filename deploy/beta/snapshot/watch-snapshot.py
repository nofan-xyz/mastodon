"""Finish unattended verification only after database AND media imports succeed."""
from pathlib import Path
import subprocess
import json
import time
import datetime
import os

os.umask(0o077)
root = Path('/home/mastodon-beta')
batch = Path((root / 'snapshot-current').read_text())
assert batch.resolve().is_relative_to((root / 'backups').resolve())

def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def read_url(url, *args):
    return subprocess.check_output(['curl', '-fsS', '--max-time', '30', *args, url]).decode()

try:
    while not ((batch / 'database.done').exists() and (batch / 'media.done').exists()):
        if not (batch / 'database.done').exists():
            active = subprocess.run(['systemctl', 'is-active', '--quiet', 'nofan-beta-snapshot-import']).returncode == 0
            if not active:
                raise RuntimeError('Database import stopped before its verification marker')
        if not (batch / 'media.done').exists():
            container = json.loads(subprocess.check_output(['docker', 'inspect', 'nofan-beta-media-snapshot']))[0]
            if not container['State']['Running'] and not container['State']['Restarting']:
                raise RuntimeError('Media copy stopped before its completion marker')
        time.sleep(30)

    subprocess.run(['python3', str(root / 'snapshot-tools/run-verify-snapshot-media.py')], check=True)
    assert read_url('https://nofan.xyz/health').strip() == 'OK'
    assert read_url('https://beta.nofan.xyz/health').strip() == 'OK'
    instance = json.loads(read_url('https://beta.nofan.xyz/api/v2/instance'))
    assert instance['version'].startswith('5.0.0.0-alpha.1+beta-47d6d67d70')
    for path in ['/inbox', '/.well-known/webfinger?resource=acct:test@nofan.xyz']:
        code = subprocess.check_output(['curl', '-sS', '--max-time', '30', '-o', '/dev/null', '-w', '%{http_code}', 'https://beta.nofan.xyz' + path]).decode()
        assert code == '403', (path, code)
    media = json.loads((batch / 'media-progress.json').read_text())
    result = {'status': 'complete', 'verified_at': stamp(), 'media_objects': media['copied'], 'media_bytes': media['bytes'], 'media_errors': media['errors'], 'production_health': 'OK', 'beta_health': 'OK', 'federation_ingress': 'blocked', 'version': instance['version']}
    assert result['media_errors'] == 0
    (batch / 'snapshot-result.json').write_text(json.dumps(result, indent=2))
    (batch / 'snapshot.done').write_text(stamp())
    print(json.dumps(result), flush=True)
except Exception as exc:
    (batch / 'snapshot-result.json').write_text(json.dumps({'status': 'needs_attention', 'checked_at': stamp(), 'error': str(exc)}, indent=2))
    raise
