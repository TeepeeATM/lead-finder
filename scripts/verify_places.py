import asyncio, json, re, html, ipaddress
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import httpx

DATA=Path('work/catalog/lead-candidates.json')
OUT=Path('work/catalog/lead-verification.jsonl')
PHONE=re.compile(r'(?<!\d)(?:\+?1[\s().-]*)?\(?[2-9]\d{2}\)?[\s().-]*[2-9]\d{2}[\s().-]*\d{4}(?!\d)')
STRIP=re.compile(r'<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)>',re.I)
TAGS=re.compile(r'<[^>]+>')
WORDS=re.compile(r'[a-z0-9]+')
SKIP={'the','and','llc','inc','ltd','company','co','corp','of','at','a'}

def eligible_url(url):
 try:
  u=urlparse(url)
  if u.scheme not in ('http','https') or not u.hostname or '.' not in u.hostname or u.username or u.password: return False
  try: ipaddress.ip_address(u.hostname); return False
  except ValueError: pass
  return u.hostname.lower() not in {'localhost'}
 except ValueError: return False

def visible(html_text):
 txt=html.unescape(TAGS.sub(' ',STRIP.sub(' ',html_text))).lower()
 return re.sub(r'\s+',' ',txt)

def identity_matches(name,text):
 words=[w for w in WORDS.findall(name.lower()) if w not in SKIP]
 if not words:return False
 norm=' '.join(WORDS.findall(text))
 if ' '.join(words) in norm:return True
 if len(words)==1:return len(words[0])>=5 and re.search(r'\b'+re.escape(words[0])+r'\b',norm) is not None
 salient=sorted((w for w in words if len(w)>=4),key=len,reverse=True)
 if len(salient)<2:return False
 return all(re.search(r'\b'+re.escape(w)+r'\b',norm) for w in salient[:2])

async def check(client,sem,candidate):
 async with sem:
  if not eligible_url(candidate['website']):return {'id':candidate['id'],'reason':'invalid_url'}
  try:
   r=await client.get(candidate['website'],follow_redirects=True)
   if r.status_code!=200 or 'text/html' not in r.headers.get('content-type',''):return {'id':candidate['id'],'reason':'http_'+str(r.status_code)}
   if not eligible_url(str(r.url)):return {'id':candidate['id'],'reason':'redirect_invalid'}
   if len(r.content)>2_000_000:return {'id':candidate['id'],'reason':'oversized'}
   text=visible(r.text)
   phone_ok=any(re.sub(r'\D','',m.group())[-10:]==candidate['phone'] for m in PHONE.finditer(text))
   if not phone_ok:return {'id':candidate['id'],'reason':'phone_not_published'}
   if not identity_matches(candidate['name'],text):return {'id':candidate['id'],'reason':'name_not_published'}
   return {'id':candidate['id'],'reason':'passed','checkedAt':datetime.now(timezone.utc).isoformat(),'contactSource':str(r.url)}
  except Exception as exc:return {'id':candidate['id'],'reason':type(exc).__name__}

async def main():
 candidates=json.loads(DATA.read_text(encoding='utf-8'))
 done={}
 if OUT.exists():
  for line in OUT.open(encoding='utf-8'):
   try:
    r=json.loads(line); done[r['id']]=r
   except (json.JSONDecodeError,KeyError):pass
 pending=[c for c in candidates if c['id'] not in done]
 limits=httpx.Limits(max_connections=24,max_keepalive_connections=12)
 async with httpx.AsyncClient(timeout=httpx.Timeout(8.0),limits=limits,headers={'User-Agent':'CairvantLeadFinder/2.0 (contact verification; public business websites)','Accept':'text/html'}) as client:
  sem=asyncio.Semaphore(20)
  with OUT.open('a',encoding='utf-8') as f:
   tasks=[asyncio.create_task(check(client,sem,c)) for c in pending]
   n=0
   for t in asyncio.as_completed(tasks):
    result=await t;f.write(json.dumps(result)+'\n');f.flush();done[result['id']]=result;n+=1
    if n%100==0:
     counts=Counter(r['reason'] for r in done.values())
     print(n,'/',len(pending),counts.most_common(8),flush=True)
 print('final',Counter(r['reason'] for r in done.values()).most_common())

if __name__ == '__main__': asyncio.run(main())
