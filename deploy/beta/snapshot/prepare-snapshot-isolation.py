import os,json,subprocess
from pathlib import Path
os.umask(0o077)
r=Path('/home/mastodon-beta'); b=Path((r/'snapshot-current').read_text())
def env(c):
 return dict(x.split('=',1) for x in json.loads(subprocess.check_output(['docker','inspect',c]))[0]['Config']['Env'] if '=' in x)
p=env('mastodon-web-1')
v=dict(x.split('=',1) for x in (r/'.env.production').read_text().splitlines() if '=' in x and not x.startswith('#'))
assert v['DB_NAME']=='mastodon_beta' and v['S3_BUCKET']=='beta-nofan-box'
for k in ['ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY','ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY','ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT','OTP_SECRET']:
 if p.get(k): v[k]=p[k]
# Preserve canonical account identity, but sessions, VAPID and all connections stay separate.
v.update(LOCAL_DOMAIN=p['LOCAL_DOMAIN'],WEB_DOMAIN='beta.nofan.xyz',NOFAN_SNAPSHOT_MODE='true',SMTP_DELIVERY_METHOD='test')
for k in list(v):
 if k.startswith('SMTP_') and k!='SMTP_DELIVERY_METHOD': del v[k]
v.pop('SINGLE_USER_MODE',None)
(b/'snapshot.env').write_text(''.join(f'{k}={x}\n' for k,x in v.items()))
# Deployed as an override so standard deployment stays independently reusable.
(r/'compose.override.yml').write_text('''services:
  web:
    environment:
      NOFAN_SNAPSHOT_MODE: 'true'
    volumes:
      - ./snapshot_isolation.rb:/opt/mastodon/config/initializers/zz_nofan_snapshot.rb:ro
  sidekiq:
    environment:
      NOFAN_SNAPSHOT_MODE: 'true'
    command: bundle exec sidekiq -C /snapshot_sidekiq.yml
    volumes:
      - ./snapshot_isolation.rb:/opt/mastodon/config/initializers/zz_nofan_snapshot.rb:ro
      - ./snapshot_sidekiq.yml:/snapshot_sidekiq.yml:ro
''')
# No inbound ActivityPub or discovery can reach the copied canonical identities.
ng=(r/'nginx.conf').read_text()
ng=ng.replace('  client_max_body_size 99m;', '  client_max_body_size 99m;\n  if ($http_accept ~* "application/(activity\\\\+json|ld\\\\+json)") { return 403; }')
ng=ng.replace('  location / {\n    proxy_pass', '  location ~ ^/(inbox|users/[^/]+/(inbox|outbox)|actor|api/v1/push/subscription|api/web/push_subscriptions|\\.well-known/(webfinger|host-meta)|nodeinfo)(/|$) { return 403; }\n\n  location / {\n    proxy_pass')
(b/'snapshot-nginx.conf').write_text(ng)
print('Prepared guarded snapshot environment, local-job allowlist and inbound federation blocks; secrets not printed')
