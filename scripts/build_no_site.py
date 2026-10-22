"""Export no-website research records separately from verified website contacts."""
import csv
import json
from pathlib import Path

leads = json.loads(Path('app/data/leads.json').read_text(encoding='utf-8'))
research = json.loads(Path('work/catalog/targeted-no-site.json').read_text(encoding='utf-8'))
known_phones = {lead['phone'] for lead in leads}
seen = set()
rows = []
for row in research:
    if row['phone'] in known_phones or row['phone'] in seen:
        continue
    seen.add(row['phone'])
    rows.append(row)

Path('app/data/no-site.json').write_text(json.dumps(rows, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
with Path('public/no-website-research.csv').open('w', newline='', encoding='utf-8-sig') as output:
    writer = csv.writer(output)
    writer.writerow(['name', 'niche', 'city', 'state', 'address', 'directory_phone_unverified',
                     'social_profile_unverified', 'source_release'])
    for row in rows:
        writer.writerow([row['name'], row['niche'], row['city'], row['state'], row['address'],
                         "'" + row['phone'], row['social'], row['release']])
print(f'{len(rows)} no-website research records; contact not independently verified')
