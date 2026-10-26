"""Prepare a protected shared deployment proposal; never activate it here."""
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit,quote
import argparse,json,os,re,subprocess

parser=argparse.ArgumentParser()
parser.add_argument('--legacy-image',required=True)
parser.add_argument('--new-image',required=True)
parser.add_argument('--streaming-image',required=True)
args=parser.parse_args()
for ref in vars(args).values():
    assert re.fullmatch(r'ghcr\.io/nofan-xyz/mastodon(?:-streaming)?@sha256:[a-f0-9]{64}',ref),'Require immutable registry digests'
os.umask(0o077)
root=Path('/home/mastodon')
config=json.loads(subprocess.check_output(['docker','compose','config','--format','json'],cwd=root))
web=config['services']['web']
env=web['environment']
assert env['LOCAL_DOMAIN']=='nofan.xyz' and env['DB_NAME']=='mastodon_production' and env['S3_BUCKET']=='nofan-box'
assert not (root/'docker-compose.override.yml').exists(),'Review an existing override before replacing it'
backup=Path((root/'shared-rollout/current-backup').read_text().strip())
assert backup.parent==root/'shared-rollout'
plan=backup/'plan'
plan.mkdir(mode=0o700,exist_ok=False)

def redis_url(db):
    if env.get('REDIS_URL'):
        u=urlsplit(env['REDIS_URL']);return urlunsplit((u.scheme,u.netloc,'/'+str(db),u.query,u.fragment))
    auth=''
    if env.get('REDIS_USER'):auth=quote(env['REDIS_USER'],safe='')
    if env.get('REDIS_PASSWORD'):auth+=':'+quote(env['REDIS_PASSWORD'],safe='')
    if auth:auth+='@'
    return 'redis://'+auth+env.get('REDIS_HOST','redis')+':'+str(env.get('REDIS_PORT',6379))+'/'+str(db)

cache47,cache50=redis_url(1),redis_url(2)
aliases=set(filter(None,re.split(r'[,\s]+',env.get('ALTERNATE_DOMAINS',''))))|{'beta.nofan.xyz'}
common={'NOFAN_SHARED_DATA':'true','NOFAN_SNAPSHOT_MODE':'false','LOCAL_DOMAIN':'nofan.xyz','WEB_DOMAIN':'nofan.xyz','ALTERNATE_DOMAINS':','.join(sorted(aliases)),'NOFAN_SHARED_WEB_ORIGINS':'https://beta.nofan.xyz','NOFAN_SHARED_CACHE_REDIS_URLS':cache47+','+cache50}
override={'services':{}}
override['services']['web']={'image':args.legacy_image,'environment':{**common,'CACHE_REDIS_URL':cache47,'CDN_HOST':'https://nofan.xyz','SOURCE_TAG':'codex/v4.7.3.3-shared-data'},'command':['bundle','exec','puma','-C','config/puma.rb'],'volumes':['./public/system:/opt/mastodon/public/system']}
for service in ['sidekiq','sidekiq-ingress','sidekiq-push']:
    override['services'][service]={'image':args.new_image,'environment':{**common,'CACHE_REDIS_URL':cache50,'CDN_HOST':'https://beta.nofan.xyz'},'volumes':['./public/system:/opt/mastodon/public/system']}
override['services']['streaming']={'image':args.streaming_image,'command':['node','./streaming/index.js']}
override['services']['web-beta']={
    'image':args.new_image,'restart':'unless-stopped','env_file':['.env.production'],
    'environment':{**common,'CACHE_REDIS_URL':cache50,'CDN_HOST':'https://beta.nofan.xyz','STREAMING_API_BASE_URL':'wss://beta.nofan.xyz','WEB_CONCURRENCY':'1','MAX_THREADS':'5','RAILS_SERVE_STATIC_FILES':'true'},
    'command':['bundle','exec','puma','-C','config/puma.rb'],
    'ports':['127.0.0.1:3106:3000'],
    'networks':['external_network','internal_network'],
    'volumes':['./public/system:/opt/mastodon/public/system'],
    'healthcheck':{'test':['CMD-SHELL','curl -fsS http://localhost:3000/health || exit 1'],'interval':'10s','timeout':'5s','retries':6},
}
(plan/'docker-compose.override.yml').write_text(json.dumps(override,indent=2)+'\n')
(plan/'release.json').write_text(json.dumps({'legacy_image':args.legacy_image,'new_image':args.new_image,'streaming_image':args.streaming_image,'backup':str(backup),'canonical_domain':'nofan.xyz','beta_port':3106,'status':'prepared'},indent=2)+'\n')
nginx=Path('/etc/nginx/conf.d/nofan-beta.conf').read_text()
assert '127.0.0.1:3105' in nginx and '127.0.0.1:4105' in nginx
nginx=nginx.replace('127.0.0.1:3105','127.0.0.1:3106').replace('127.0.0.1:4105','127.0.0.1:4000')
# Keep discovery/federation on the canonical host, while enabling real Web Push.
nginx=nginx.replace('return 403; }\n  include','return 308 https://nofan.xyz$request_uri; }\n  include')
nginx=nginx.replace('|api/v1/push/subscription|api/web/push_subscriptions','')
(plan/'nofan-beta.conf').write_text(nginx)
subprocess.run(['docker','compose','-f','docker-compose.yml','-f',str(plan/'docker-compose.override.yml'),'config','--quiet'],cwd=root,check=True)
(root/'shared-rollout/current-plan').write_text(str(plan)+'\n')
print('Prepared validated proposal '+str(plan)+'; no services or live configuration changed')
