from pathlib import Path
import subprocess
r=Path('/home/mastodon-beta'); b=Path((r/'snapshot-current').read_text())
v=dict(x.split('=',1) for x in (r/'.env').read_text().splitlines() if '=' in x)
subprocess.run(['docker','run','--rm','--user','0:0','--env-file',str(r/'.env.production'),'-v',str(b)+':/snapshot:ro','-v',str(r/'snapshot-tools/verify_snapshot_media.rb')+':/verify_snapshot_media.rb:ro','--entrypoint','bundle',v['MASTODON_IMAGE'],'exec','ruby','/verify_snapshot_media.rb'],check=True)
