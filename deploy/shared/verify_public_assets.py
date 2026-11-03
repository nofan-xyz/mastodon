from html.parser import HTMLParser
from urllib.parse import urljoin,urlsplit
import subprocess,json
class Assets(HTMLParser):
    def __init__(self):super().__init__();self.urls=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='script' and a.get('src'):self.urls.append(a['src'])
        if tag=='link' and a.get('rel')=='stylesheet' and a.get('href'):self.urls.append(a['href'])
for host in ['nofan.xyz','beta.nofan.xyz']:
    origin='https://'+host
    html=subprocess.check_output(['curl','-fsS','--max-time','30',origin+'/auth/sign_in']).decode()
    parsed=Assets();parsed.feed(html)
    urls=set(urljoin(origin,u) for u in parsed.urls)
    assert urls,'No login page assets found'
    for url in urls:
        assert urlsplit(url).hostname in ['nofan.xyz','beta.nofan.xyz']
        subprocess.run(['curl','-fsS','--max-time','30',url,'-o','/dev/null'],check=True)
    print(json.dumps({'host':host,'login_page_assets_readable':len(urls)}),flush=True)
files=subprocess.check_output(['docker','exec','mastodon-web-beta-1','find','/opt/mastodon/public/packs','-type','f']).decode().splitlines()
styles=[p for p in files if p.endswith('.css') and ('bird-ui' in p or 'tangerine' in p)]
assert any('bird-ui' in p for p in styles) and any('tangerine' in p for p in styles),'Custom flavour CSS missing'
for path in styles:
    url='https://beta.nofan.xyz'+path.split('/public',1)[1]
    subprocess.run(['curl','-fsS','--max-time','30',url,'-o','/dev/null'],check=True)
print(json.dumps({'x_ui_and_tangerine_styles_readable':len(styles)}),flush=True)
