"""Collect research prospects whose Overture record lists no website.

These are intentionally marked unverified; a directory phone is not a tested contact.
"""
import json
import re
import ast
import csv
from pathlib import Path

selection = ast.parse(Path('scripts/select_places.py').read_text(encoding='utf-8'))
constants = {target.id: ast.literal_eval(node.value)
             for node in selection.body if isinstance(node, ast.Assign)
             for target in node.targets if isinstance(target, ast.Name) and target.id in ('NICHE', 'TOWNS')}
NICHE, TOWNS = constants['NICHE'], constants['TOWNS']

existing = {lead['phone'] for lead in json.loads(Path('app/data/leads.json').read_text(encoding='utf-8'))}
seen = set(existing)
rows = []
for line in Path('work/catalog/memphis-places.geojsonseq').open(encoding='utf-8'):
    place = json.loads(line)
    info = place['properties']
    category = (info.get('taxonomy') or {}).get('primary')
    address = next((item for item in info.get('addresses') or []
                    if (item.get('locality') or '').lower() in TOWNS and item.get('country') == 'US'), None)
    if (category not in NICHE or not address or info.get('confidence', 0) < .95
            or info.get('operating_status') != 'open' or info.get('websites') or not info.get('phones')):
        continue
    if any(source.get('license') != 'CDLA-Permissive-2.0' for source in info.get('sources') or []):
        continue
    phone = re.sub(r'\D', '', info['phones'][0])[-10:]
    name = (info.get('names') or {}).get('primary')
    if not name or len(phone) != 10 or phone in seen or phone[0] in '01' or phone[3] in '01':
        continue
    socials = [url for url in info.get('socials') or [] if url.startswith(('https://', 'http://'))]
    if not socials:
        continue
    seen.add(phone)
    rows.append({'id': place['id'], 'name': name, 'niche': NICHE[category],
                 'city': address['locality'], 'state': address.get('region'),
                 'address': address.get('freeform'), 'phone': phone,
                 'social': socials[0], 'confidence': info['confidence'],
                 'release': '2026-09-23.1'})
rows.sort(key=lambda row: (row['niche'], row['city'], row['name']))
Path('app/data/no-site.json').write_text(json.dumps(rows, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
with Path('public/no-website-research-2026-10-22.csv').open('w', newline='', encoding='utf-8-sig') as output:
    writer = csv.writer(output)
    writer.writerow(['name','niche','city','state','address','directory_phone_unverified','social_profile_unverified','source_release'])
    for row in rows:
        writer.writerow([row['name'],row['niche'],row['city'],row['state'],row['address'],"'" + row['phone'],row['social'],row['release']])
print(f'{len(rows)} distinct research prospects with a social link and no website in Overture')
