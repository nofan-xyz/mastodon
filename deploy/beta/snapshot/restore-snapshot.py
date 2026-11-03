from pathlib import Path
import subprocess,shutil,os,time,json
os.umask(0o077)
r=Path('/home/mastodon-beta'); b=Path((r/'snapshot-current').read_text())
tools=r/'snapshot-tools'
os.chdir(r)
def run(a,**kw): return subprocess.run(a,check=True,**kw)
def dc(*a,**kw): return run(['docker','compose','-f','compose.yml','-f','compose.override.yml',*a],**kw)
def sql(q,db='mastodon_beta'):
 return run(['docker','exec','-i','nofan-beta-db-1','psql','-v','ON_ERROR_STOP=1','-U','mastodon','-d',db],input=q.encode())
print('Waiting for consistent production dump',flush=True)
while not (b/'dump.done').exists():
 pid=int((b/'dump.pid').read_text())
 try: os.kill(pid,0)
 except ProcessLookupError: raise RuntimeError('Production dump stopped before completion')
 time.sleep(20)
run(['docker','exec','nofan-beta-db-1','pg_restore','--version'])
ng=(b/'snapshot-nginx.conf').read_text()
maintenance=ng.replace('  client_max_body_size 99m;','  return 503; # snapshot import\n  client_max_body_size 99m;')
Path('/etc/nginx/conf.d/nofan-beta.conf').write_text(maintenance)
run(['nginx','-t']); run(['systemctl','reload','nginx'])
dc('stop','web','sidekiq','streaming')
shutil.copy2(b/'snapshot.env',r/'.env.production')
shutil.copy2(tools/'snapshot_isolation.rb',r/'snapshot_isolation.rb')
shutil.copy2(tools/'snapshot_sidekiq.yml',r/'snapshot_sidekiq.yml')
os.chmod(r/'snapshot_isolation.rb',0o644); os.chmod(r/'snapshot_sidekiq.yml',0o644)
sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='mastodon_beta' AND pid<>pg_backend_pid();\nDROP DATABASE mastodon_beta;\nCREATE DATABASE mastodon_beta OWNER mastodon;",db='postgres')
# Mount the completed dump into a dedicated restore container on beta's network.
v=dict(x.split('=',1) for x in (r/'.env').read_text().splitlines() if '=' in x)
env=os.environ.copy(); env['PGPASSWORD']=v['BETA_DB_PASSWORD']
print('Restoring production snapshot to isolated beta database',flush=True)
run(['docker','run','--rm','--network','nofan-beta_internal','-e','PGPASSWORD','-v',str(b)+':/snapshot:ro','postgres:14-alpine','pg_restore','-h','db','-U','mastodon','-d','mastodon_beta','--no-owner','--no-privileges','--exit-on-error','-j','4','/snapshot/production.dump'],env=env)
digest_query="SELECT md5(string_agg(id::text || ':' || encrypted_password || ':' || COALESCE(settings::text,''), '|' ORDER BY id)) FROM users"
def user_digest():
 return subprocess.check_output(['docker','exec','nofan-beta-db-1','psql','-U','mastodon','-d','mastodon_beta','-Atc',digest_query]).decode().strip()
before_digest=user_digest()
(b/'restored-users.digest').write_text(before_digest)
sql((tools/'snapshot-sanitize.sql').read_text())
# Flush only the independent beta Redis; copied production queues are never restored.
run(['docker','exec','nofan-beta-redis-1','redis-cli','FLUSHALL'])
dc('run','--rm','-T','web','bundle','exec','rails','db:migrate')
if user_digest()!=before_digest: raise RuntimeError('User passwords/settings changed during upgrade; maintenance retained')
for script in ['verify_snapshot_isolation.rb','snapshot_finalize.rb','verify_snapshot_application.rb']:
 dc('run','--rm','-T','-v',str(tools/script)+':/tmp/'+script+':ro','web','bundle','exec','rails','runner','/tmp/'+script)
dc('up','-d','web','sidekiq','streaming')
for attempt in range(90):
 if subprocess.run(['curl','-fsS','http://127.0.0.1:3105/health'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0: break
 time.sleep(5)
else: raise RuntimeError('Beta web health timeout; maintenance retained')
Path('/etc/nginx/conf.d/nofan-beta.conf').write_text(ng)
shutil.copy2(b/'snapshot-nginx.conf',r/'nginx.conf')
run(['nginx','-t']); run(['systemctl','reload','nginx'])
(b/'database.done').write_text(time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()))
print('DATABASE SNAPSHOT IMPORT COMPLETE; media progress is tracked separately',flush=True)
