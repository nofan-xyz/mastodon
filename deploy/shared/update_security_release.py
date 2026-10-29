"""Deploy accepted v4.7.4 / alpha.2 security images with a verified backup and no migrations."""
import argparse,json,os,shutil,subprocess,time,urllib.request
from pathlib import Path
os.umask(0o077)
p=argparse.ArgumentParser();p.add_argument('--acceptance',required=True);a=p.parse_args()
r=Path('/home/mastodon');lab=Path('/home/mastodon-shared-rehearsal');accept=Path(a.acceptance).resolve()
assert accept.is_relative_to(lab/'results')
v=json.loads(accept.read_text())
assert all(v['checks'].get(k) is True for k in ['ci47','ci50','unit47','unit50','typecheck47','typecheck50','lint','build47','build50','hover_source_unchanged','private_reply_edge','private_reply_webkit_layout','rehearsal_http','rehearsal_media','rehearsal_text'])
backup=Path((r/'shared-rollout/current-backup').read_text().strip()).resolve();assert backup.is_relative_to(r/'shared-rollout') and (backup/'backup.done').is_file() and (backup/'production.dump').stat().st_size>1000000
assert time.time()-(backup/'backup.done').stat().st_mtime<86400
roles=['web','web-beta','sidekiq','sidekiq-ingress','sidekiq-push']
assert set(v['images'])==set(roles) and set(v['previous_images'])==set(roles)
for label in ['47','50']:
 manifest=Path(v['manifests'][label]).resolve();assert manifest.is_relative_to(lab/'results')
 assert json.loads(manifest.read_text())['source_commit']==v['sources'][label]
 image=v['images']['web' if label=='47' else 'web-beta'];assert image.startswith('ghcr.io/nofan-xyz/mastodon@sha256:')
 subprocess.run(['docker','run','--rm','-v',str(manifest)+':/overlay-manifest.json:ro','-v',str(lab/'tools/verify_overlay.rb')+':/verify.rb:ro','--entrypoint','bundle',image,'exec','ruby','/verify.rb'],check=True)
path=r/'docker-compose.override.yml';old=json.loads(path.read_text());new=json.loads(path.read_text())
assert all(old['services'][role]['image']==v['previous_images'][role] for role in roles)
assert old['services']['streaming']['image']==v['streaming_unchanged']
assert old['services']['web']['environment']['CDN_HOST']==''
assert old['services']['web-beta']['environment']['NOFAN_SHARED_DATA']=='true'
run=r/'shared-rollout'/(time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())+'-security-release');run.mkdir(mode=0o700)
shutil.copyfile(path,run/'before-compose.override.yml');shutil.copyfile(r/'shared-release.json',run/'before-release.json');shutil.copyfile(accept,run/'acceptance.json')
for role in roles:new['services'][role]['image']=v['images'][role]
new['services']['web']['environment']['SOURCE_TAG']='codex/v4.7.4-shared-data'
(run/'proposed-compose.override.yml').write_text(json.dumps(new,indent=2)+'\n')
started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
def compose(*args):subprocess.run(['docker','compose',*args],cwd=r,check=True)
def healthy():
 try:
  for port in [3000,3106]:
   with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/health',timeout=5) as res:
    if res.status!=200:return False
  rows=[json.loads(x) for x in subprocess.check_output(['docker','compose','ps','--format','json'],cwd=r,text=True).splitlines() if x]
  return all(any(row['Service']==role and row['Health']=='healthy' for row in rows) for role in roles)
 except Exception:return False
subprocess.run(['python3', str(Path(__file__).with_name('retain_beta_assets.py')), '--image', old['services']['web-beta']['image']], check=True)

try:
 path.write_text(json.dumps(new,indent=2)+'\n');compose('config','--quiet')
 compose('run','--rm','-T','--no-deps','web-beta','bundle','exec','rails','db:abort_if_pending_migrations')
 compose('stop','-t','90','sidekiq','sidekiq-ingress','sidekiq-push');compose('up','-d','--no-deps',*roles)
 end=time.time()+240
 while time.time()<end:
  if healthy():break
  time.sleep(3)
 else:raise RuntimeError('Patched application health timeout')
 for role in ['web','web-beta']:compose('exec','-T',role,'bundle','exec','rails','runner',"%w(api/v1/instances/show api/v2/instances/show).each { |key| Rails.cache.delete(key) }")
 compose('exec','-T','--user','0:0','web-beta','bundle','exec','rails','runner','/opt/mastodon/deploy/shared/verify_production.rb')
 compose('exec','-T','web-beta','bundle','exec','rails','runner','/opt/mastodon/deploy/shared/verify_production_jobs.rb',started)
except Exception:
 shutil.copyfile(run/'before-compose.override.yml',path);compose('config','--quiet');compose('up','-d','--no-deps',*roles)
 print('Previous Web/worker configuration restored; live data retained',flush=True);raise
release=json.loads((r/'shared-release.json').read_text());release['old_image']=v['images']['web'];release['legacy_image']=v['images']['web'];release['new_image']=v['images']['web-beta']
receipt={'at':started,'sources':v['sources'],'images':v['images'],'streaming_unchanged':v['streaming_unchanged'],'database_backup':str(backup),'database_migrated':False,'application_config_backup':str(run)}
release.setdefault('updates',[]).append(receipt);plan=Path((r/'shared-rollout/current-plan').read_text().strip())
for target in [r/'shared-release.json',plan/'release.json',run/'release.json']:target.write_text(json.dumps(release,indent=2)+'\n')
shutil.copyfile(path,plan/'docker-compose.override.yml');(run/'deployed.json').write_text(json.dumps(receipt,indent=2)+'\n');(r/'shared-rollout/current-security-update').write_text(str(run)+'\n')
print('PASS accepted v4.7.4 and alpha.2 security release deployed; no database migration; Streaming unchanged',flush=True)
