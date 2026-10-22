import json, csv
from collections import Counter
from urllib.parse import urlparse
from pathlib import Path

base=Path('work/catalog')
candidates={c['id']:c for c in json.loads((base/'lead-candidates.json').read_text(encoding='utf-8'))}
checks={}
for file in ('lead-verification.jsonl','lead-contact-verification.jsonl'):
 p=base/file
 if p.exists():
  for line in p.open(encoding='utf-8'):
   r=json.loads(line)
   if r['reason']=='passed': checks[r['id']]=r
output=[]
for id,r in checks.items():
 c=candidates[id]
 if any(s.get('license')!='CDLA-Permissive-2.0' for s in c.get('sources') or []):continue
 host=(urlparse(c['website']).hostname or '').lower().removeprefix('www.')
 if host.endswith(('edan.io','jany.io')):continue
 output.append({'id':id,'name':c['name'],'niche':c['niche'],'city':c['city'],'state':c['state'],'website':c['website'],'phone':c['phone'],'contactSource':r['contactSource'],'catalogCheckedAt':r['checkedAt'],'confidence':round(c['confidence'],4),'release':c['recordRelease']})
output.sort(key=lambda x:(x['niche'],x['city'],-x['confidence'],x['name']))
target=Path('app/data/leads.json')
target.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
with Path('public/targeted-verified-catalog.csv').open('w',newline='',encoding='utf-8-sig') as file:
 writer=csv.writer(file)
 writer.writerow(['name','niche','city','state','website','published_phone','contact_source','checked_at','source_release'])
 for row in output:
  writer.writerow([row['name'],row['niche'],row['city'],row['state'],row['website'],"'"+row['phone'],row['contactSource'],row['catalogCheckedAt'],row['release']])
print('packaged',len(output),'niches',Counter(x['niche'] for x in output).most_common(),'bytes',target.stat().st_size)

