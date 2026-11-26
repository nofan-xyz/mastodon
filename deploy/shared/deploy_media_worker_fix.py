from pathlib import Path
import json,os,shutil,subprocess,time,urllib.request
os.umask(0o077)
root=Path('/home/mastodon')
plan=Path((root/'shared-rollout/current-plan').read_text().strip())
path=root/'docker-compose.override.yml'
values=json.loads(path.read_text())
image='ghcr.io/nofan-xyz/mastodon@sha256:e736342d74cd43d3409a81d160f7b284c8d68c88b764072bd5cbabe8a60f3c61'
assert values['services']['web-beta']['environment']['NOFAN_SHARED_DATA']=='true'
assert values['services']['web']['image'].endswith('6cf1fb7e9a85b7446f1393d79f47c73392d08157ff6778ee0a67f54fb171a0f0')
shutil.copyfile(path,plan/'before-media-fix-compose.override.yml')
for name in ['web-beta','sidekiq','sidekiq-ingress','sidekiq-push']:values['services'][name]['image']=image
path.write_text(json.dumps(values,indent=2)+'\n')
subprocess.run(['docker','compose','config','--quiet'],cwd=root,check=True)
print('Updating 5.0 Web and workers; no database migration or media changes',flush=True)
subprocess.run(['docker','compose','stop','-t','90','sidekiq','sidekiq-ingress','sidekiq-push'],cwd=root,check=True)
subprocess.run(['docker','compose','up','-d','--no-deps','web-beta','sidekiq','sidekiq-ingress','sidekiq-push'],cwd=root,check=True)
deadline=time.time()+150
while time.time()<deadline:
    try:
        with urllib.request.urlopen('http://127.0.0.1:3106/health',timeout=3) as response:
            if response.status==200:break
    except Exception:pass
    time.sleep(2)
else:raise RuntimeError('New Web did not become healthy; keep old image backup')
release=json.loads((root/'shared-release.json').read_text())
release.setdefault('updates',[]).append({'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'from':release['new_image'],'to':image,'reason':'stale service worker media CSP recovery'})
release['new_image']=image
for target in [root/'shared-release.json',plan/'release.json']:target.write_text(json.dumps(release,indent=2)+'\n')
shutil.copyfile(path,plan/'docker-compose.override.yml')
subprocess.run(['docker','compose','exec','-T','web-beta','bundle','exec','rails','runner',"%w(api/v1/instances/show api/v2/instances/show).each { |key| Rails.cache.delete(key) }; puts 'Instance caches refreshed'"],cwd=root,check=True)
print('Media Worker fix deployed and healthy',flush=True)
