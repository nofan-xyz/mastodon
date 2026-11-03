import subprocess,json
from pathlib import Path
r=Path('/home/mastodon-beta')
prod=json.loads(subprocess.check_output(['docker','inspect','mastodon-web-1']))[0]
image=prod['Image']
cmd=['docker','run','--rm','--network','nofan-beta_internal','--env-file',str(r/'.env.production'),'-v',str(r/'snapshot_isolation.rb')+':/opt/mastodon/config/initializers/zz_nofan_snapshot.rb:ro','-v','/tmp/probe-47-on-50-snapshot.rb:/tmp/probe.rb:ro',image,'bundle','exec','rails','runner','/tmp/probe.rb']
subprocess.run(cmd,check=True)
