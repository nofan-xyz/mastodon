"""Verify final registry images match rehearsed runtime files and stage them privately."""
from pathlib import Path
import json,subprocess
root=Path('/home/mastodon-shared-rehearsal')
refs={
 '47':'ghcr.io/nofan-xyz/mastodon:shared47-1d03b99d8412785da33b127eb72336d0898045bc',
 '50':'ghcr.io/nofan-xyz/mastodon:beta-bc6791217d59b4fb283bb792f08e402f239975fe',
 'streaming':'ghcr.io/nofan-xyz/mastodon-streaming:beta-bc6791217d59b4fb283bb792f08e402f239975fe',
}
commits={'47':'1d03b99d8412785da33b127eb72336d0898045bc','50':'bc6791217d59b4fb283bb792f08e402f239975fe'}
results={}
for version,tag in refs.items():
    info=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]
    env=dict(x.split('=',1) for x in info['Config']['Env'] if '=' in x)
    digest=info['RepoDigests'][0]
    if version!='streaming':
        assert env['SOURCE_COMMIT']==commits[version],'Registry image revision mismatch'
        manifest=json.loads((root/'build'/version/'manifest.json').read_text())
        manifest['source_commit']=commits[version]
        path=root/'results'/('registry-manifest-'+version+'.json')
        path.write_text(json.dumps(manifest))
        subprocess.run(['docker','run','--rm','-v',str(path)+':/overlay-manifest.json:ro','-v',str(root/'tools/verify_overlay.rb')+':/verify_overlay.rb:ro','--entrypoint','bundle',digest,'exec','ruby','/verify_overlay.rb'],check=True)
    results[version]={'image':digest,'source_commit':env.get('SOURCE_COMMIT'),'image_id':info['Id']}
with (root/'.env').open('a') as handle:
    handle.write('PATCHED_IMAGE47='+results['47']['image']+'\nPATCHED_IMAGE50='+results['50']['image']+'\nSTREAMING_IMAGE='+results['streaming']['image']+'\n')
(root/'results/registry-images.json').write_text(json.dumps(results,indent=2))
subprocess.run(['docker','compose','up','-d','web47','web50','worker50','streaming'],cwd=root,check=True)
print('Final immutable registry images match every rehearsed runtime file; restarted isolated project only',flush=True)
