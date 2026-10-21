import asyncio, json, re
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
import httpx
from verify_places import eligible_url, visible, identity_matches, PHONE

BASE=Path('work/catalog/lead-verification.jsonl')
OUT=Path('work/catalog/lead-contact-verification.jsonl')
class Links(HTMLParser):
 def __init__(self):super().__init__();self.hrefs=[]
 def handle_starttag(self,tag,attrs):
  if tag=='a':
   href=dict(attrs).get('href','')
   if re.search(r'contact|location|about',href,re.I):self.hrefs.append(href)

async def check(client,sem,c):
 async with sem:
  try:
   home=await client.get(c['website'],follow_redirects=True)
   if home.status_code!=200 or len(home.content)>2_000_000:return {'id':c['id'],'reason':'home_unavailable'}
   pages=[]; links=Links();links.feed(home.text)
   for h in links.hrefs:
    url=urljoin(str(home.url),h)
    if urlparse(url).hostname==urlparse(str(home.url)).hostname and eligible_url(url) and url not in pages: pages.append(url)
   for suffix in ('/contact','/contact-us'):
    url=urljoin(str(home.url),suffix)
    if url not in pages:pages.append(url)
   for url in pages[:3]:
    try:
     r=await client.get(url,follow_redirects=True)
     if r.status_code!=200 or 'text/html' not in r.headers.get('content-type','') or len(r.content)>2_000_000:continue
     if urlparse(str(r.url)).hostname!=urlparse(str(home.url)).hostname:continue
     text=visible(r.text)
     phone_ok=any(re.sub(r'\D','',m.group())[-10:]==c['phone'] for m in PHONE.finditer(text))
     if phone_ok and identity_matches(c['name'],text):
      return {'id':c['id'],'reason':'passed','checkedAt':datetime.now(timezone.utc).isoformat(),'contactSource':str(r.url)}
    except Exception:continue
   return {'id':c['id'],'reason':'contact_page_no_match'}
  except Exception as exc:return {'id':c['id'],'reason':type(exc).__name__}

async def main():
 candidates={c['id']:c for c in json.loads(Path('work/catalog/lead-candidates.json').read_text(encoding='utf-8'))}
 base={r['id']:r for r in map(json.loads,BASE.open(encoding='utf-8'))}
 done={}
 if OUT.exists():
  for line in OUT.open(encoding='utf-8'):
   try:r=json.loads(line);done[r['id']]=r
   except Exception:pass
 pending=[candidates[k] for k,r in base.items() if r['reason'] in ('phone_not_published','name_not_published') and k not in done]
 async with httpx.AsyncClient(timeout=httpx.Timeout(8.0),limits=httpx.Limits(max_connections=20,max_keepalive_connections=10),headers={'User-Agent':'CairvantLeadFinder/2.0 (contact verification; public business websites)','Accept':'text/html'}) as client:
  sem=asyncio.Semaphore(15)
  with OUT.open('a',encoding='utf-8') as f:
   tasks=[asyncio.create_task(check(client,sem,c)) for c in pending]
   n=0
   for t in asyncio.as_completed(tasks):
    r=await t;f.write(json.dumps(r)+'\n');f.flush();done[r['id']]=r;n+=1
    if n%100==0:print(n,'/',len(pending),Counter(v['reason'] for v in done.values()).most_common(5),flush=True)
 print('final',Counter(v['reason'] for v in done.values()).most_common())

asyncio.run(main())
