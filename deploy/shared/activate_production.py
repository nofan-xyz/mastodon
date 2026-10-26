"""Activate only the validated shared plan after backup and final-image rehearsal."""
from pathlib import Path
import argparse,json,os,shutil,subprocess,time,urllib.request

parser=argparse.ArgumentParser()
parser.add_argument('--apply',action='store_true',required=True)
parser.parse_args()
os.umask(0o077)
root=Path('/home/mastodon')
plan=Path((root/'shared-rollout/current-plan').read_text().strip())
assert plan.parent.parent==root/'shared-rollout'
release=json.loads((plan/'release.json').read_text())
backup=Path(release['backup'])
assert (backup/'backup.done').is_file(),'Wait for consistent backup completion'
assert Path('/home/mastodon-shared-rehearsal/results/registry-acceptance.done').is_file(),'Final images have not passed rehearsal'
registry=json.loads(Path('/home/mastodon-shared-rehearsal/results/registry-images.json').read_text())
assert release['legacy_image']==registry['47']['image'] and release['new_image']==registry['50']['image'] and release['streaming_image']==registry['streaming']['image']
assert not (root/'docker-compose.override.yml').exists(),'Unexpected existing production override'

def run(args,**kwargs):return subprocess.run(args,cwd=root,check=True,**kwargs)
def compose(*args):return run(['docker','compose',*args])
def sql(query):
    return subprocess.check_output(['docker','exec','-i','mastodon-db-1','psql','-U','postgres','-d','mastodon_production','-v','ON_ERROR_STOP=1','-qAt'],input=query.encode()).decode().strip()
def identity():
    return json.loads(sql("""SELECT json_build_object(
    'users',(SELECT count(*) FROM users),
    'passwords',(SELECT md5(string_agg(id::text || ':' || encrypted_password,'|' ORDER BY id)) FROM users),
    'keys',(SELECT md5(string_agg(k.id::text || ':' || COALESCE(k.private_key,''),'|' ORDER BY k.id)) FROM keypairs k JOIN accounts a ON a.id=k.account_id WHERE a.domain IS NULL),
    'legacy_keys',(SELECT md5(string_agg(id::text || ':' || private_key,'|' ORDER BY id)) FROM accounts WHERE private_key IS NOT NULL));"""))
def health(port):
    try:
        with urllib.request.urlopen('http://127.0.0.1:'+str(port)+'/health',timeout=5) as response:return response.status==200
    except Exception:return False

def wait_health():
    deadline=time.time()+180
    while time.time()<deadline:
        if all(health(port) for port in [3000,3106]):return
        time.sleep(2)
    raise RuntimeError('Shared Web health check failed; retain expanded DB and inspect services')

current=json.loads(subprocess.check_output(['docker','inspect','mastodon-web-1']))[0]
image=json.loads(subprocess.check_output(['docker','image','inspect',current['Image']]))[0]
assert 'SOURCE_COMMIT=0afb546c7d8139688642c80c1cc14d6e17335317' in image['Config']['Env'],'Live legacy source changed since preflight'
print('Stopping legacy consumers and Web gracefully for shared schema handoff',flush=True)
compose('stop','-t','90','sidekiq','sidekiq-ingress','sidekiq-push','web')
before=identity()
shutil.copyfile(plan/'docker-compose.override.yml',root/'docker-compose.override.yml')
os.chmod(root/'docker-compose.override.yml',0o600)
try:
    print('Applying rehearsed expand-only coexistence migrations',flush=True)
    compose('run','--rm','--no-deps','-T','web-beta','bundle','exec','rails','db:migrate')
    after=identity()
    assert before==after,'Identity invariants changed during migration'
    (plan/'migration-invariants.json').write_text(json.dumps({'before':before,'after':after},indent=2))
except Exception:
    # No 5.0 consumer has been started: resume the original images with retained
    # legacy columns. Never restore an old database over newer user writes.
    (root/'docker-compose.override.yml').rename(plan/'failed-migration-override.yml')
    compose('up','-d','--no-deps','web','sidekiq','sidekiq-ingress','sidekiq-push')
    raise
print('Starting both Web versions and the single 5.0 worker group',flush=True)
compose('up','-d','--no-deps','web','web-beta','sidekiq','sidekiq-ingress','sidekiq-push','streaming')
wait_health()
nginx=Path('/etc/nginx/conf.d/nofan-beta.conf')
shutil.copyfile(nginx,plan/'nginx-before-activation.conf')
shutil.copyfile(plan/'nofan-beta.conf',nginx)
try:run(['nginx','-t'])
except Exception:
    shutil.copyfile(plan/'nginx-before-activation.conf',nginx)
    raise
run(['systemctl','reload','nginx'])
for host in ['nofan.xyz','beta.nofan.xyz']:
    response=json.loads(subprocess.check_output(['curl','-fsS','--max-time','30','https://'+host+'/api/v2/instance']))
    assert response['domain']=='nofan.xyz','Incorrect canonical identity through '+host
    print(json.dumps({'host':host,'version':response['version'],'domain':response['domain']}),flush=True)
print('Stopping superseded beta snapshot producers; preserving all snapshot storage',flush=True)
for name in ['nofan-beta-media-snapshot','nofan-beta-snapshot-verify']:
    exists=subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
    if exists:run(['docker','stop','-t','30',name])
subprocess.run(['docker','compose','stop','-t','60','web','sidekiq','streaming'],cwd='/home/mastodon-beta',check=True)
release['status']='active'
release['activated_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
(plan/'release.json').write_text(json.dumps(release,indent=2)+'\n')
(root/'shared-release.json').write_text(json.dumps(release,indent=2)+'\n')
(plan/'activated.done').write_text(release['activated_at']+'\n')
print('Shared deployment activated; run public and authenticated readback checks next',flush=True)
