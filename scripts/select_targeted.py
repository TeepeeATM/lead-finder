"""Select regional website-redesign prospects from a free Overture Places extract."""
import json
import os
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

SOURCE = Path('work/catalog/region-places.geojsonseq')
RELEASE = os.environ.get('OVERTURE_RELEASE', '2026-10-21.0')
NICHE = {
    'hvac_service': 'HVAC',
    'roofing': 'Roofing',
    'plumbing': 'Plumbing',
    'electrician': 'Electricians',
    'landscaping': 'Landscaping & lawn care',
    'lawn_service': 'Landscaping & lawn care',
    'tree_service': 'Landscaping & lawn care',
    'home_cleaning': 'Cleaning services',
    'cleaning_service': 'Cleaning services',
    'office_cleaning': 'Cleaning services',
    'automotive_repair': 'Auto repair',
    'tire_dealer_and_repair': 'Auto repair',
    'auto_body_shop': 'Auto repair',
    'contractor': 'Remodeling & contractors',
    'altering_and_remodeling_contractor': 'Remodeling & contractors',
    'bathroom_remodeling': 'Remodeling & contractors',
    'kitchen_remodeling': 'Remodeling & contractors',
    'building_contractor': 'Remodeling & contractors',
    'pest_control_service': 'Pest control',
    'garage_door_service': 'Garage doors',
}
BLOCK = {'facebook.com', 'instagram.com', 'yelp.com', 'yellowpages.com', 'mapquest.com',
         'google.com', 'bing.com', 'linkedin.com', 'tripadvisor.com', 'chamberofcommerce.com'}

def phone_number(value):
    digits = re.sub(r'\D', '', value)[-10:]
    return digits if len(digits) == 10 and digits[0] not in '01' and digits[3] not in '01' else None

def main():
    candidates, no_site, seen = [], [], set()
    for line in SOURCE.open(encoding='utf-8'):
        place = json.loads(line)
        item = place['properties']
        category = (item.get('taxonomy') or {}).get('primary')
        if category not in NICHE or item.get('confidence', 0) < .90 or item.get('operating_status') != 'open':
            continue
        if any(source.get('license') != 'CDLA-Permissive-2.0' for source in item.get('sources') or []):
            continue
        address = next((part for part in item.get('addresses') or []
                        if part.get('country') == 'US' and part.get('region') in ('TN', 'MS', 'AR')
                        and part.get('locality')), None)
        name = (item.get('names') or {}).get('primary')
        phone = phone_number((item.get('phones') or [''])[0])
        if not address or not name or not phone:
            continue
        key = (name.casefold(), address['locality'].casefold(), phone)
        if key in seen:
            continue
        seen.add(key)
        common = {'id': place['id'], 'name': name, 'niche': NICHE[category], 'category': category,
                  'city': address['locality'], 'state': address['region'], 'address': address.get('freeform'),
                  'website': None, 'phone': phone, 'confidence': item['confidence'],
                  'recordRelease': RELEASE, 'sources': item.get('sources')}
        websites = item.get('websites') or []
        website = next((url for url in websites if urlparse(url).scheme in ('http', 'https')
                        and urlparse(url).hostname and not any(
                            urlparse(url).hostname.lower().removeprefix('www.').endswith(block) for block in BLOCK)), None)
        if website:
            candidates.append({**common, 'website': website})
        elif not websites and item.get('socials'):
            social = next((url for url in item['socials'] if url.startswith(('https://', 'http://'))), None)
            if social:
                no_site.append({key: common[key] for key in ('id', 'name', 'niche', 'city', 'state', 'address', 'phone', 'confidence')}
                               | {'social': social, 'release': RELEASE})
    candidates.sort(key=lambda row: (row['niche'], row['city'], -row['confidence'], row['name']))
    no_site.sort(key=lambda row: (row['niche'], row['city'], row['name']))
    Path('work/catalog/lead-candidates.json').write_text(json.dumps(candidates, ensure_ascii=False), encoding='utf-8')
    Path('work/catalog/targeted-no-site.json').write_text(json.dumps(no_site, ensure_ascii=False), encoding='utf-8')
    print('website candidates', len(candidates), Counter(row['niche'] for row in candidates).most_common())
    print('no-site research records', len(no_site), Counter(row['niche'] for row in no_site).most_common())

if __name__ == '__main__':
    main()
