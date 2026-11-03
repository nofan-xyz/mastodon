from pathlib import Path
import os,shutil,subprocess
os.umask(0o077)
root=Path('/home/mastodon')
plan=Path((root/'shared-rollout/current-plan').read_text().strip())
for name,upstream in [('nofan-beta.conf','http://127.0.0.1:3106'),('mastodon.conf','http://backend')]:
    path=Path('/etc/nginx/conf.d')/name
    old=path.read_text()
    backup=plan/('before-sw-cache-'+name)
    if not backup.exists():shutil.copyfile(path,backup)
    location='''  location = /sw.js {
    proxy_pass UPSTREAM;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_hide_header Cache-Control;
    add_header Cache-Control "no-store" always;
    add_header Strict-Transport-Security 'max-age=31536000' always;
    add_header X-Robots-Tag 'noindex, nofollow' always;
  }
'''.replace('UPSTREAM',upstream)
    if name=='mastodon.conf':
        start=old.index('  location = /sw.js {')
        end=old.index('\n  }',start)+len('\n  }')
        new=old[:start]+location.rstrip()+old[end:]
    elif 'location = /sw.js {' not in old:
        new=old.replace('  location / {\n    proxy_pass',location+'\n  location / {\n    proxy_pass',1)
    else:raise RuntimeError('Inspect an existing beta SW location before replacing it')
    path.write_text(new)
try:subprocess.run(['nginx','-t'],check=True)
except Exception:
    for name in ['nofan-beta.conf','mastodon.conf']:
        shutil.copyfile(plan/('before-sw-cache-'+name),Path('/etc/nginx/conf.d')/name)
    raise
subprocess.run(['systemctl','reload','nginx'],check=True)
shutil.copyfile('/etc/nginx/conf.d/nofan-beta.conf',plan/'nofan-beta.conf')
print('Stable worker endpoints now bypass long-lived cache; ordinary assets unchanged')
