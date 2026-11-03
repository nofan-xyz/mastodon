from pathlib import Path
from datetime import datetime,timezone
import json,os,shutil,subprocess
os.umask(0o077)
source=Path('/home/mastodon')
root=source/'shared-rollout'/datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
root.mkdir(parents=True,mode=0o700)
for name in ['.env','.env.production','docker-compose.yml','docker-compose.override.yml','compose.override.yml']:
    path=source/name
    if path.is_file():shutil.copyfile(path,root/name);os.chmod(root/name,0o600)
for prefix,path in [('beta-nginx','/etc/nginx/conf.d/nofan-beta.conf'),('beta-compose','/home/mastodon-beta/compose.yml'),('beta-override','/home/mastodon-beta/compose.override.yml'),('beta-env','/home/mastodon-beta/.env'),('beta-app-env','/home/mastodon-beta/.env.production')]:
    if Path(path).is_file():shutil.copyfile(path,root/prefix);os.chmod(root/prefix,0o600)
(root/'production-compose-resolved.json').write_bytes(subprocess.check_output(['docker','compose','config','--format','json'],cwd=source))
(root/'production-containers.json').write_bytes(subprocess.check_output(['docker','inspect','mastodon-web-1','mastodon-sidekiq-1','mastodon-sidekiq-ingress-1','mastodon-sidekiq-push-1','mastodon-streaming-1']))
(source/'shared-rollout/current-backup').write_text(str(root)+'\n')
print('Started consistent read-only production backup: '+str(root),flush=True)
with (root/'production.dump.partial').open('wb') as output, (root/'pg-dump.log').open('wb') as log:
    subprocess.run(['docker','exec','mastodon-db-1','pg_dump','-U','postgres','-Fc','mastodon_production'],stdout=output,stderr=log,check=True)
(root/'production.dump.partial').rename(root/'production.dump')
with (root/'restore-list.txt').open('wb') as output:
    subprocess.run(['docker','run','--rm','-v',str(root)+':/backup:ro','postgres:14-alpine','pg_restore','--list','/backup/production.dump'],stdout=output,check=True)
(root/'backup.done').write_text(datetime.now(timezone.utc).isoformat()+'\n')
print('Consistent production backup complete; restore table of contents verified',flush=True)
