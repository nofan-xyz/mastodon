from pathlib import Path
import json,os,shutil,subprocess,time,urllib.request
os.umask(0o077)
root=Path('/home/mastodon')
plan=Path((root/'shared-rollout/current-plan').read_text().strip())
p=root/'docker-compose.override.yml'
values=json.loads(p.read_text())
web=values['services']['web']
assert web['image'].endswith('6cf1fb7e9a85b7446f1393d79f47c73392d08157ff6778ee0a67f54fb171a0f0')
shutil.copyfile(p,plan/'before-ban-assets-compose.override.yml')
web['environment']['CDN_HOST']=''
p.write_text(json.dumps(values,indent=2)+'\n')
subprocess.run(['docker','compose','config','--quiet'],cwd=root,check=True)
subprocess.run(['docker','compose','up','-d','--no-deps','web'],cwd=root,check=True)
deadline=time.time()+120
while time.time()<deadline:
 try:
  with urllib.request.urlopen('http://127.0.0.1:3000/health',timeout=3) as r:
   if r.status==200:break
 except Exception:pass
 time.sleep(2)
else:raise RuntimeError('Legacy Web health timeout')
shutil.copyfile(p,plan/'docker-compose.override.yml')
print('Legacy Web healthy; fixed host-independent asset URLs; beta asset host unchanged',flush=True)
