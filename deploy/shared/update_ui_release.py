"""Deploy an accepted UI-only release without running database migrations."""
import argparse,json,os,shutil,subprocess,time,urllib.request
from pathlib import Path
os.umask(0o077)
p=argparse.ArgumentParser()
p.add_argument('--image',required=True)
p.add_argument('--source-commit',required=True)
a=p.parse_args()
assert a.image.startswith('ghcr.io/nofan-xyz/mastodon@sha256:') and len(a.source_commit)==40
root=Path('/home/mastodon');lab=Path('/home/mastodon-shared-rehearsal')
accepted=json.loads((lab/'results/composer-ui-accepted.json').read_text())
assert accepted['image']==a.image and accepted['source_commit']==a.source_commit
assert accepted['built_cases']==48 and accepted['unit_tests']==44
assert all(accepted['checks'].get(k) for k in ['ci','typecheck','lint','unit','dev_matrix','built_matrix','windows_edge','windows_chrome'])
manifest=lab/'results/composer-ui-full-manifest.json'
assert json.loads(manifest.read_text())['source_commit']==a.source_commit
subprocess.run(['docker','run','--rm','-v',str(manifest)+':/overlay-manifest.json:ro','-v',str(lab/'tools/verify_overlay.rb')+':/verify.rb:ro','--entrypoint','bundle',a.image,'exec','ruby','/verify.rb'],check=True)
path=root/'docker-compose.override.yml';old=json.loads(path.read_text());new=json.loads(path.read_text())
roles=['web-beta','sidekiq','sidekiq-ingress','sidekiq-push']
previous='ghcr.io/nofan-xyz/mastodon@sha256:fc3b0ed459196defa19a129ec4c61f33dcaccbe57fdf51acc7d69a4c6c86052f'
assert all(old['services'][role]['image']==previous for role in roles)
assert old['services']['web']['image'].endswith('6cf1fb7e9a85b7446f1393d79f47c73392d08157ff6778ee0a67f54fb171a0f0')
assert old['services']['web']['environment']['CDN_HOST']==''
assert old['services']['web-beta']['environment']['NOFAN_SHARED_DATA']=='true'
run=root/'shared-rollout'/(time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-composer-ui')
run.mkdir(mode=0o700)
shutil.copyfile(path,run/'before-compose.override.yml')
shutil.copyfile(root/'shared-release.json',run/'before-release.json')
shutil.copyfile(lab/'results/composer-ui-accepted.json',run/'acceptance.json')
for role in roles:new['services'][role]['image']=a.image
(run/'proposed-compose.override.yml').write_text(json.dumps(new,indent=2)+'\n')
started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def compose(*args):subprocess.run(['docker','compose',*args],cwd=root,check=True)
def health(port):
 try:
  with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/health',timeout=5) as response:return response.status==200
 except Exception:return False
try:
 path.write_text(json.dumps(new,indent=2)+'\n')
 compose('config','--quiet')
 # This task only reads the migration list; never migrate as part of a UI update.
 compose('run','--rm','-T','--no-deps','web-beta','bundle','exec','rails','db:abort_if_pending_migrations')
 compose('stop','-t','90','sidekiq','sidekiq-ingress','sidekiq-push')
 compose('up','-d','--no-deps',*roles)
 deadline=time.time()+180
 while time.time()<deadline:
  if health(3000) and health(3106):break
  time.sleep(2)
 else:raise RuntimeError('Web health timeout')
 compose('exec','-T','web-beta','bundle','exec','rails','runner',"%w(api/v1/instances/show api/v2/instances/show).each { |key| Rails.cache.delete(key) }")
 compose('exec','-T','--user','0:0','web-beta','bundle','exec','rails','runner','/opt/mastodon/deploy/shared/verify_production.rb')
 compose('exec','-T','web-beta','bundle','exec','rails','runner','/opt/mastodon/deploy/shared/verify_production_jobs.rb',started)
except Exception:
 shutil.copyfile(run/'before-compose.override.yml',path)
 compose('config','--quiet');compose('up','-d','--no-deps',*roles)
 print('Restored the previous application images; database and live writes retained',flush=True)
 raise
release=json.loads((root/'shared-release.json').read_text())
release['new_image']=a.image
release.setdefault('updates',[]).append({'at':started,'from':previous,'to':a.image,'source_commit':a.source_commit,'reason':'composer overlay and hover compatibility','application_config_backup':str(run)})
plan=Path((root/'shared-rollout/current-plan').read_text().strip())
for target in [root/'shared-release.json',plan/'release.json',run/'release.json']:target.write_text(json.dumps(release,indent=2)+'\n')
shutil.copyfile(path,plan/'docker-compose.override.yml')
(run/'deployed.json').write_text(json.dumps({'started_at':started,'source_commit':a.source_commit,'image':a.image,'database_migrated':False,'legacy_image':old['services']['web']['image'],'streaming_unchanged':old['services']['streaming']['image']},indent=2)+'\n')
(root/'shared-rollout/current-ui-update').write_text(str(run)+'\n')
print('UI release deployed; previous image/config retained; no database migrations',flush=True)