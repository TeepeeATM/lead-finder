import json, re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

NICHE = {
 'barber':'Barbershops','hair_salon':'Hair salons','beauty_salon':'Beauty salons','nail_salon':'Nail salons','spa':'Spas & med spas',
 'gym':'Gyms & fitness','automotive_repair':'Auto repair','dental_clinic':'Dentists','hvac_service':'HVAC','roofing':'Roofing',
 'contractor':'Contractors','plumber':'Plumbers','electrician':'Electricians','landscaping':'Landscaping','lawn_care':'Lawn care',
 'bakery':'Bakeries','coffee_shop':'Coffee shops','restaurant':'Restaurants','mexican_restaurant':'Restaurants','american_restaurant':'Restaurants','barbecue_restaurant':'Restaurants','pizza_restaurant':'Restaurants','chicken_restaurant':'Restaurants','burger_restaurant':'Restaurants',
 'flowers_and_gifts_store':'Florists & gifts','veterinarian':'Veterinarians','pet_grooming':'Pet grooming','cleaning_service':'Cleaning services','real_estate_agent':'Real estate agents','insurance_agency':'Insurance agencies','property_management':'Property management',
 'physical_therapy':'Physical therapy','optometry':'Optometrists','chiropractic':'Chiropractors','day_care':'Day care','photographer':'Photographers',
}
TOWNS={'memphis','southaven','olive branch','horn lake','tunica','hernando','germantown','bartlett','collierville','cordova','millington'}
BLOCK={'facebook.com','instagram.com','yelp.com','yellowpages.com','mapquest.com','google.com','bing.com','linkedin.com','tripadvisor.com','doordash.com','grubhub.com','opentable.com','chamberofcommerce.com'}
found=[]; counts=Counter(); seen=set()
for line in Path('work/catalog/memphis-places.geojsonseq').open(encoding='utf-8'):
 d=json.loads(line); x=d['properties']; cat=(x.get('taxonomy') or {}).get('primary')
 if cat not in NICHE or x.get('confidence',0)<.95 or x.get('operating_status')!='open':continue
 a=next((a for a in (x.get('addresses') or []) if (a.get('locality') or '').lower() in TOWNS and a.get('country')=='US'),None)
 if not a:continue
 name=(x.get('names') or {}).get('primary')
 phones=x.get('phones') or []; sites=x.get('websites') or []
 if not name or not phones or not sites:continue
 digits=re.sub(r'\D','',phones[0])[-10:]
 if len(digits)!=10 or digits[0] in '01' or digits[3] in '01':continue
 site=sites[0]; host=(urlparse(site).hostname or '').lower().removeprefix('www.')
 if any(host==b or host.endswith('.'+b) for b in BLOCK):continue
 key=(name.lower(),a.get('locality','').lower(),digits)
 if key in seen:continue
 seen.add(key)
 row={'id':d['id'],'name':name,'niche':NICHE[cat],'category':cat,'city':a['locality'],'state':a.get('region'),'address':a.get('freeform'),'postcode':a.get('postcode'),'website':site,'phone':digits,'confidence':x['confidence'],'operatingStatus':x['operating_status'],'sources':x.get('sources'),'recordRelease':'2026-09-23.1'}
 found.append(row);counts[row['niche']]+=1
found.sort(key=lambda x:(x['niche'], -x['confidence'], x['name']))
Path('work/catalog/lead-candidates.json').write_text(json.dumps(found,ensure_ascii=False),encoding='utf-8')
print('eligible',len(found))
print(counts.most_common())

