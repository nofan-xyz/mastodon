import subprocess,os,json,datetime
from pathlib import Path
os.umask(0o077)
r=Path('/home/mastodon-beta')
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
b=r/'backups'/('snapshot-'+stamp); b.mkdir()
(r/'snapshot-current').write_text(str(b))
def run(a,**kw): return subprocess.run(a,check=True,**kw)
for f in ['.env.production','compose.yml','nginx.conf']:
 (b/f).write_bytes((r/f).read_bytes())
# The production database is only read by pg_dump. Existing beta can be restored.
with (b/'beta-before.dump').open('wb') as f:
 run(['docker','exec','nofan-beta-db-1','pg_dump','-U','mastodon','-Fc','mastodon_beta'],stdout=f)
for name,db,user,container in [('production','mastodon_production','postgres','mastodon-db-1')]:
 script=b/'dump.sh'
 script.write_text('#!/bin/sh\nset -eu\numask 077\ndocker exec '+container+' pg_dump -U '+user+' -Fc '+db+' > '+str(b/name)+'.dump.partial\nmv '+str(b/name)+'.dump.partial '+str(b/name)+'.dump\ndate -u > '+str(b/'dump.done')+'\n')
 with (b/'dump.log').open('wb') as log:
  p=subprocess.Popen(['bash',str(script)],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 (b/'dump.pid').write_text(str(p.pid))
print('Started consistent read-only production pg_dump; protected beta backup:',b)
