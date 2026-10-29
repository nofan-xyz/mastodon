from pathlib import Path
import hashlib
import json
import os
import subprocess

os.umask(0o077)
root = Path('/home/mastodon-shared-rehearsal')
assert (root / 'results/restore.done').exists()
prod = json.loads(subprocess.check_output(['docker', 'inspect', 'mastodon-web-1']))[0]
metadata = json.loads(subprocess.check_output(['docker', 'image', 'inspect', prod['Image']]))[0]
source = dict(v.split('=', 1) for v in metadata['Config']['Env'] if '=' in v)
assert source['SOURCE_COMMIT'] == '0afb546c7d8139688642c80c1cc14d6e17335317'
base47 = metadata['RepoDigests'][0]
base50 = json.loads(Path('/home/mastodon-beta/release.json').read_text())['MASTODON_IMAGE']
results = {}
for version, base in [('47', base47), ('50', base50)]:
    context = root / 'build' / version
    manifest = json.loads((context / 'manifest.json').read_text())
    for rel, expected in manifest['files'].items():
        assert hashlib.sha256((context / 'overlay' / rel).read_bytes()).hexdigest() == expected
    revision = manifest['source_commit']
    tag = 'nofan-shared-rehearsal-' + version + ':' + revision[:12]
    args = ['docker', 'build', '--pull=false', '--build-arg', 'BASE_IMAGE=' + base, '--build-arg', 'PATCH_REVISION=' + revision, '--build-arg', 'PATCH_METADATA=shared' + version + '-' + revision[:12], '-t', tag, str(context)]
    print('Building isolated rehearsal image ' + version, flush=True)
    with (root / 'results' / ('build-' + version + '.log')).open('wb') as log:
        subprocess.run(args, stdout=log, stderr=subprocess.STDOUT, check=True)
    verify = ['docker', 'run', '--rm', '-v', str(context / 'manifest.json') + ':/overlay-manifest.json:ro', '-v', str(root / 'tools/verify_overlay.rb') + ':/verify_overlay.rb:ro', '--entrypoint', 'bundle', tag, 'exec', 'ruby', '/verify_overlay.rb']
    subprocess.run(verify, check=True)
    results[version] = {'tag': tag, 'revision': revision, 'image_id': json.loads(subprocess.check_output(['docker', 'image', 'inspect', tag]))[0]['Id'], 'base': base}
with (root / '.env').open('a') as handle:
    handle.write('PATCHED_IMAGE47=' + results['47']['tag'] + '\nPATCHED_IMAGE50=' + results['50']['tag'] + '\n')
(root / 'results/images.json').write_text(json.dumps(results, indent=2))
print('Both rehearsal image overlays and dependency versions verified', flush=True)
