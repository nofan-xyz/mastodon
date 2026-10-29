"""Stage a verified full image in the existing isolated rehearsal only."""
from pathlib import Path
import argparse,json,subprocess,shutil,os,time,urllib.request
os.umask(0o077)
a=argparse.ArgumentParser();a.add_argument('--image',required=True);args=a.parse_args()
assert args.image.startswith('ghcr.io/nofan-xyz/mastodon@sha256:')
root=Path('/home/mastodon-shared-rehearsal')
env=dict(x.split('=',1) for x in (root/'.env.production').read_text().splitlines() if '=' in x)
assert env['NOFAN_REHEARSAL']=='true' and env['DB_HOST']=='db' and env['DB_NAME']=='mastodon_shared_rehearsal'
assert env['S3_BUCKET']=='beta-nofan-box' and env['S3_KEY_PREFIX'].startswith('shared-rehearsal-')
assert (root/'results/upstream-20261027-identity.json').exists()
subprocess.run(['docker','run','--rm','-v',str(root/'results/upstream-full-manifest.json')+':/overlay-manifest.json:ro','-v',str(root/'tools/verify_overlay.rb')+':/verify_overlay.rb:ro','--entrypoint','bundle',args.image,'exec','ruby','/verify_overlay.rb'],check=True)
backup=root/'results/before-upstream-20261027';backup.mkdir(mode=0o700)
for name in ['.env','compose.override.yml']:shutil.copyfile(root/name,backup/name)
values=dict(x.split('=',1) for x in (root/'.env').read_text().splitlines() if '=' in x)
values['PATCHED_IMAGE50']=args.image
values['PATCHED_IMAGE47']='ghcr.io/nofan-xyz/mastodon@sha256:6cf1fb7e9a85b7446f1393d79f47c73392d08157ff6778ee0a67f54fb171a0f0'
(root/'.env').write_text(''.join(k+'='+v+'\n' for k,v in values.items()))
s=(root/'compose.override.yml').read_text().replace('CDN_HOST: https://nofan.xyz',"CDN_HOST: ''")
(root/'compose.override.yml').write_text(s)
subprocess.run(['docker','compose','config','--quiet'],cwd=root,check=True)
subprocess.run(['docker','compose','run','--rm','-T','--no-deps','web50','bundle','exec','rails','db:migrate'],cwd=root,check=True)
subprocess.run(['docker','compose','run','--rm','-T','--no-deps','--user','0:0','-v',str(root/'results')+':/results','-v',str(root/'tools/verify_upstream_rehearsal.rb')+':/verify.rb:ro','web50','bundle','exec','rails','runner','/verify.rb','after'],cwd=root,check=True)
subprocess.run(['docker','compose','up','-d','--no-deps','web47','web50','worker50','streaming'],cwd=root,check=True)
end=time.time()+180
while time.time()<end:
 try:
  for port in [3204,3205]:
   with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/health',timeout=3) as r:assert r.status==200
  break
 except Exception:time.sleep(2)
else:raise RuntimeError('Rehearsal Web health timeout')
(root/'results/upstream-20261027-staged.json').write_text(json.dumps({'image':args.image,'source_commit':'b7bdcba68320de523bbd6c763129586f89926145','at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}))
print('Isolated 4.7/new 5.0 healthy; migration and identity invariants passed',flush=True)
