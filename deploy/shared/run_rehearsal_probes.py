from pathlib import Path
import concurrent.futures
import subprocess
import time
root=Path('/home/mastodon-shared-rehearsal')
assert (root/'results/initialized.done').exists()
base=['docker','compose','run','--rm','-T','--user','0:0','-v',str(root/'results')+':/results','-v',str(root/'tools/probe_rehearsal.rb')+':/probe.rb:ro']
def run(node,*args):
    result=subprocess.run(base+[node,'bundle','exec','rails','runner','/probe.rb',*args],cwd=root,capture_output=True,text=True,timeout=180)
    if result.stdout:print(result.stdout,flush=True,end='')
    if result.returncode:
        print(result.stderr[-5000:],flush=True)
        raise RuntimeError('Probe failed: '+node+' '+args[0])
for name in ['prefs-loaded','prefs-written']:
    (root/'results'/name).unlink(missing_ok=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    stale=pool.submit(run,'web47','stale')
    current=pool.submit(run,'web50','new-preference')
    stale.result();current.result()
run('web50','preferences-check')
run('web47','site-write','Rehearsal title from 4.7')
run('web50','site-check','Rehearsal title from 4.7')
run('web50','site-write','Rehearsal title from 5.0')
run('web47','site-check','Rehearsal title from 5.0')
run('web47','fasp-create')
run('web50','fasp-enable')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(lambda node:run(node,'fasp-check'),['web47','web50']))
run('web50','jobs-check')
print('All shared model probes passed',flush=True)
