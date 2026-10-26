"""Deploy an accepted full upstream image, retaining the legacy Web and streaming."""
from pathlib import Path
import argparse,json,os,shutil,subprocess,time,urllib.request
os.umask(0o077)
p=argparse.ArgumentParser();p.add_argument('--image',required=True);a=p.parse_args()
root=Path('/home/mastodon');lab=Path('/home/mastodon-shared-rehearsal')
assert a.image.startswith('ghcr.io/nofan-xyz/mastodon@sha256:')
accepted=json.loads((lab/'results/upstream-20261027-accepted.json').read_text())
assert accepted['image']==a.image and accepted['source_commit']=='b7bdcba68320de523bbd6c763129586f89926145'
assert all(accepted['checks'].get(k) for k in ['manifest','migration','http','text','media','limits','models','browser'])
backup=Path((root/'shared-rollout/current-backup').read_text().strip())
assert backup.parent==root/'shared-rollout' and (backup/'backup.done').is_file()
assert (backup/'production.dump').stat().st_size>1_000_000
run=backup/'upstream-release';run.mkdir(mode=0o700)
path=root/'docker-compose.override.yml';old=json.loads(path.read_text());new=json.loads(path.read_text())
roles=['web-beta','sidekiq','sidekiq-ingress','sidekiq-push']
old_image='ghcr.io/nofan-xyz/mastodon@sha256:b81ddcf72bc68f25755919686c5f1b17e3c54d011d57fbc9107ce0c687aa6f09'
assert all(old['services'][k]['image']==old_image for k in roles)
assert old['services']['web']['image'].endswith('6cf1fb7e9a85b7446f1393d79f47c73392d08157ff6778ee0a67f54fb171a0f0')
assert old['services']['web']['environment']['CDN_HOST']==''
assert old['services']['web-beta']['environment']['NOFAN_SHARED_DATA']=='true'
shutil.copyfile(path,run/'before-compose.override.yml')
shutil.copyfile(root/'shared-release.json',run/'before-release.json')
shutil.copyfile(lab/'results/upstream-20261027-accepted.json',run/'acceptance.json')
for k in roles:new['services'][k]['image']=a.image
(run/'proposed-compose.override.yml').write_text(json.dumps(new,indent=2)+'\n')
started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def compose(*args):return subprocess.run(['docker','compose',*args],cwd=root,check=True)
def verify(mode):
 compose('run','--rm','-T','--no-deps','--user','0:0','-v',str(run)+':/release','-v',str(lab/'tools/verify_upstream_production.rb')+':/verify.rb:ro','web-beta','bundle','exec','rails','runner','/verify.rb',mode)
def health(port):
 try:
  with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/health',timeout=5) as r:return r.status==200
 except Exception:return False
changed=False
try:
 path.write_text(json.dumps(new,indent=2)+'\n');changed=True
 compose('config','--quiet');verify('before')
 print('Gracefully pausing 5.0 consumers for the rehearsed additive migration',flush=True)
 compose('stop','-t','90','sidekiq','sidekiq-ingress','sidekiq-push')
 compose('run','--rm','-T','--no-deps','-e','PGOPTIONS=-c lock_timeout=5s -c statement_timeout=120s','web-beta','bundle','exec','rails','db:migrate')
 verify('after')
 compose('up','-d','--no-deps',*roles)
 end=time.time()+180
 while time.time()<end:
  if health(3000) and health(3106):break
  time.sleep(2)
 else:raise RuntimeError('New Web health timeout')
 compose('exec','-T','web-beta','bundle','exec','rails','runner',"%w(api/v1/instances/show api/v2/instances/show).each { |k| Rails.cache.delete(k) }")
 compose('exec','-T','--user','0:0','web-beta','bundle','exec','rails','runner','/opt/mastodon/deploy/shared/verify_production.rb')
except Exception:
 if changed:
  shutil.copyfile(run/'before-compose.override.yml',path)
  compose('config','--quiet');compose('up','-d','--no-deps',*roles)
  print('Restored previous application images; retained additive schema and all live writes',flush=True)
 raise
release=json.loads((root/'shared-release.json').read_text())
release.setdefault('updates',[]).append({'at':started,'from':old_image,'to':a.image,'reason':'upstream main 08941b303f / Ruby 4.0.8','backup':str(backup)})
release['new_image']=a.image;release['backup']=str(backup)
plan=Path((root/'shared-rollout/current-plan').read_text().strip())
for target in [root/'shared-release.json',plan/'release.json',run/'release.json']:target.write_text(json.dumps(release,indent=2)+'\n')
shutil.copyfile(path,plan/'docker-compose.override.yml')
(run/'deployed.json').write_text(json.dumps({'started_at':started,'image':a.image,'source_commit':'b7bdcba68320de523bbd6c763129586f89926145','legacy_image':old['services']['web']['image'],'streaming_unchanged':old['services']['streaming']['image']},indent=2)+'\n')
print('Upstream full image deployed; shared authenticated readback and identity checks passed',flush=True)
