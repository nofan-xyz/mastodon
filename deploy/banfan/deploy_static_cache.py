from pathlib import Path
import datetime,subprocess,shutil,os,json
os.umask(0o077)
source=Path(__file__).resolve().parent
backup=Path('/var/backups/banfan')/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ-static-cache')
backup.mkdir(mode=0o700,parents=True)
global_conf=Path('/etc/nginx/conf.d/00-banfan-static-cache.conf')
server_conf=Path('/etc/nginx/snippets/banfan-static-cache.conf')
assert not global_conf.exists() and not server_conf.exists(), 'Already installed; inspect existing state before updating'
main=Path('/etc/nginx/sites-enabled/ban.fan').resolve(strict=True)
trial=Path('/etc/nginx/conf.d/banfan-http1-trial.conf')
originals={main:main.read_bytes()}
if trial.exists():originals[trial]=trial.read_bytes()
for i,(p,data) in enumerate(originals.items()):(backup/f'original-{i}.conf').write_bytes(data)
manifest={'backup':str(backup),'files':{str(p):f'original-{i}.conf' for i,p in enumerate(originals)}}
(backup/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
rollback=backup/'rollback.py'
rollback.write_text("from pathlib import Path\nimport json,subprocess\nb=Path(__file__).resolve().parent\nm=json.loads((b/'manifest.json').read_text())\nfor name,copy in m['files'].items():\n p=Path(name)\n if p.exists():p.write_bytes((b/copy).read_bytes())\nfor name in ['/etc/nginx/conf.d/00-banfan-static-cache.conf','/etc/nginx/snippets/banfan-static-cache.conf']:Path(name).unlink(missing_ok=True)\nsubprocess.run(['nginx','-t'],check=True)\nsubprocess.run(['systemctl','reload','nginx'],check=True)\n")
rollback.chmod(0o700)
try:
 subprocess.run(['install','-d','-o','www-data','-g','www-data','-m','750','/var/cache/nginx/banfan-static'],check=True)
 for src,dst in [('static-cache-http.conf',global_conf),('static-cache-server.conf',server_conf)]:
  dst.write_bytes((source/src).read_bytes());dst.chmod(0o644)
 for p,data in originals.items():
  text=data.decode();assert text.count('    location / {')==1
  p.write_text(text.replace('    location / {','    include /etc/nginx/snippets/banfan-static-cache.conf;\n\n    location / {',1))
 subprocess.run(['nginx','-t'],check=True)
 subprocess.run(['systemctl','reload','nginx'],check=True)
except Exception:
 subprocess.run(['python3',str(rollback)],check=True)
 raise
print(json.dumps(manifest))
