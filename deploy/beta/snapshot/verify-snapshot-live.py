import subprocess,json,http.cookies,email
def inspect(name): return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
def env(obj): return dict(x.split('=',1) for x in obj['Config']['Env'] if '=' in x)
p=inspect('mastodon-web-1'); b=inspect('nofan-beta-web-1')
pe,be=env(p),env(b)
assert pe['DB_NAME']!='mastodon_beta' and be['DB_NAME']=='mastodon_beta'
assert be['LOCAL_DOMAIN']=='nofan.xyz' and be['WEB_DOMAIN']=='beta.nofan.xyz' and be['NOFAN_SNAPSHOT_MODE']=='true'
assert pe['S3_BUCKET']=='nofan-box' and be['S3_BUCKET']=='beta-nofan-box'
assert all(pe[k]==be[k] for k in ['AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY'])
assert set(p['NetworkSettings']['Networks']).isdisjoint(b['NetworkSettings']['Networks'])
assert set(inspect('mastodon-db-1')['NetworkSettings']['Networks']).isdisjoint(inspect('nofan-beta-db-1')['NetworkSettings']['Networks'])
def get(url):
 raw=subprocess.check_output(['curl','-fsS','--max-time','30','-D','-',url])
 header,_,body=raw.partition(b'\r\n\r\n')
 while body.startswith(b'HTTP/'):
  header,_,body=body.partition(b'\r\n\r\n')
 lines=header.split(b'\r\n')
 return int(lines[0].split()[1]),body,email.message_from_bytes(b'\r\n'.join(lines[1:]))
_,pb,_=get('https://nofan.xyz/api/v2/instance')
_,bb,_=get('https://beta.nofan.xyz/api/v2/instance')
prod,beta=json.loads(pb),json.loads(bb)
assert prod['version']=='4.7.3.3'
assert beta['domain']=='nofan.xyz' and beta['title']=='nofan' and beta['version'].startswith('5.0.0.0-alpha.1+beta-47d6d67d70')
status,html,headers=get('https://beta.nofan.xyz/auth/sign_in')
assert status==200
cookies=http.cookies.SimpleCookie()
for value in headers.get_all('Set-Cookie',[]): cookies.load(value)
assert '_mastodon_session' in cookies and not cookies['_mastodon_session']['domain']
for path,accept in [('/inbox','text/html'),('/users/admin','application/activity+json'),('/.well-known/webfinger?resource=acct:test@nofan.xyz','application/jrd+json')]:
 code=subprocess.check_output(['curl','-sS','--max-time','30','-o','/dev/null','-w','%{http_code}','-H','Accept: '+accept,'https://beta.nofan.xyz'+path]).decode()
 assert code=='403'
print(json.dumps({'production_version':prod['version'],'beta_version':beta['version'],'beta_title':beta['title'],'account_domain':beta['domain'],'streaming':beta.get('configuration',{}).get('urls',{}).get('streaming'),'login_page':'200','cookies':'host-only','database_networks':'separate','media_buckets':'separate','shared_s3_credentials':'verified, not printed','federation_ingress':'403'}))
