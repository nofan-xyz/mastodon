import subprocess,os
from pathlib import Path
os.umask(0o077)
r=Path('/home/mastodon-beta'); b=Path((r/'snapshot-current').read_text())
v=dict(x.split('=',1) for x in (r/'.env.production').read_text().splitlines() if '=' in x and not x.startswith('#'))
assert v['S3_BUCKET']=='beta-nofan-box'
d=dict(x.split('=',1) for x in (r/'.env').read_text().splitlines() if '=' in x)
args=['docker','run','-d','--name','nofan-beta-media-snapshot','--restart','on-failure:3','--env-file',str(r/'.env.production'),'-e','SNAPSHOT_SOURCE_BUCKET=nofan-box','-v',str(b)+':/snapshot','-v','/tmp/snapshot_media.rb:/snapshot_media.rb:ro','--entrypoint','bundle',d['MASTODON_IMAGE'],'exec','ruby','/snapshot_media.rb']
# Image user needs write access only to this job's protected directory.
args[args.index('--env-file'):args.index('--env-file')]=['--user','0:0']
subprocess.run(args,check=True)
print('Background media copy started; source read-only, destination beta bucket only')
