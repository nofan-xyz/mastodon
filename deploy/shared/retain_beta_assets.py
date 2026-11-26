"""Retain immutable previous beta assets so open tabs survive application upgrades."""
from pathlib import Path
import subprocess,shutil,time,json,hashlib,argparse,re
p=argparse.ArgumentParser();p.add_argument('--image',required=True);args=p.parse_args()
old=args.image;assert re.fullmatch(r'ghcr\.io/nofan-xyz/mastodon@sha256:[0-9a-f]{64}',old)
configs=[p.resolve() for p in Path('/etc/nginx/conf.d').glob('nofan-beta.conf') if p.is_file() and 'server_name beta.nofan.xyz;' in p.read_text() and 'listen 443' in p.read_text()]
assert len(set(configs))==1
conf=configs[0];before=conf.read_text()
run=Path('/home/mastodon/shared-rollout')/(time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-legacy-assets');run.mkdir(mode=0o700)
shutil.copyfile(conf,run/'before-nginx.conf')
cid=subprocess.check_output(['docker','create',old],text=True).strip()
try:subprocess.run(['docker','cp',cid+':/opt/mastodon/public/packs',str(run/'packs')],check=True)
finally:subprocess.run(['docker','rm',cid],check=True,stdout=subprocess.DEVNULL)
root=Path('/var/www/nofan-beta-asset-history');root.mkdir(mode=0o755,exist_ok=True);copied=[]
for src in (run/'packs').rglob('*'):
 if not src.is_file() or src.is_symlink() or '.vite' in src.parts or src.suffix == '.map':continue
 rel=src.relative_to(run);dst=root/rel;assert dst.resolve().is_relative_to(root.resolve())
 if dst.exists():assert hashlib.sha256(dst.read_bytes()).digest()==hashlib.sha256(src.read_bytes()).digest();continue
 dst.parent.mkdir(parents=True,exist_ok=True,mode=0o755);shutil.copyfile(src,dst);dst.chmod(0o644);copied.append(str(rel))
block='''  # Previous immutable bundles retained for tabs opened before an upgrade.
  location ^~ /packs/ {
    root /var/www/nofan-beta-asset-history;
    try_files $uri @beta_current_assets;
    add_header Cache-Control "public, max-age=2419200, immutable";
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
  }
  location @beta_current_assets {
    proxy_pass http://127.0.0.1:3106;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }

'''
assert before.count('  location = /sw.js {')==1
if 'nofan-beta-asset-history' in before:assert block in before
try:
 conf.write_text(before if block in before else before.replace('  location = /sw.js {',block+'  location = /sw.js {',1))
 subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
except Exception:
 conf.write_text(before);subprocess.run(['nginx','-t'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True);raise
(run/'receipt.json').write_text(json.dumps({'config':str(conf),'old_image':old,'archive':str(root),'added_files':copied},indent=2))
print('PASS old immutable assets retained:',len(copied),'backup:',str(run),flush=True)
