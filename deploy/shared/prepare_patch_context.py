"""Build a code-only context over a fixed image; no environment files are copied."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('project')
parser.add_argument('baseline')
parser.add_argument('destination')
parser.add_argument('--gem', action='append', default=[])
args = parser.parse_args()
project = Path(args.project).resolve()
destination = Path(args.destination).resolve()
assert not destination.exists(), 'Use a new context directory for every artifact'

def git(*argv):
    return subprocess.check_output(['git', '-C', str(project), *argv])

assert not git('diff', '--name-only', 'HEAD', '--', 'app', 'config', 'db', 'Gemfile', 'Gemfile.lock').strip(), 'Commit runtime changes before building'
changed = set(git('diff', '--name-only', '-z', args.baseline, 'HEAD').decode().split('\0'))
runtime = sorted(p for p in changed if p and (p.startswith(('app/', 'config/', 'db/')) or p in {'Gemfile', 'Gemfile.lock'}))
assert not any(p.startswith('app/javascript/') for p in runtime), 'Frontend changes require a full application image build'
assert all((project / p).is_file() for p in runtime), 'Runtime deletions require an explicit image migration'
assert all(not (project / p).is_symlink() for p in runtime), 'Runtime overlays must contain regular files'
destination.mkdir(parents=True)
(destination / 'overlay').mkdir()
(destination / 'gems').mkdir()
(destination / 'gems/.keep').touch()
manifest = {}
for rel in runtime:
    target = destination / 'overlay' / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(project / rel, target)
    manifest[rel] = hashlib.sha256(target.read_bytes()).hexdigest()
for gem in args.gem:
    path = Path(gem)
    assert path.is_file() and path.suffix == '.gem'
    shutil.copyfile(path, destination / 'gems' / path.name)
shutil.copyfile(Path(__file__).with_name('Dockerfile.patch'), destination / 'Dockerfile')
result = {'source_commit': git('rev-parse', 'HEAD').decode().strip(), 'baseline': args.baseline, 'files': manifest}
result['overlay_sha256'] = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
(destination / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'source_commit': result['source_commit'], 'overlay_sha256': result['overlay_sha256'], 'files': len(runtime)}))
