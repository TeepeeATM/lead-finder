# Cairvant Lead Finder

The app contains a dated, local lead catalog drawn from [Overture Maps Places](https://docs.overturemaps.org/guides/places/) release `2026-09-23.1`. It covers the Memphis metro and North Mississippi and currently has 526 records in 23 niches. The build filters for Overture existence confidence of at least 0.95, `operating_status = open`, a local town, a website, and a phone. It then fetches the business website, requiring the business name and exact phone in page text. Sites or contact pages that fail are excluded. The app checks the same source again before displaying each result. It never fills gaps with invented businesses.

The default search is now **Website fixes**: 32 distinct businesses whose checked page HTML showed at least two concrete issues on October 22, 2026 (missing mobile viewport, missing or generic page title, missing search description, or no dedicated contact/booking/quote URL in fetched HTML). Each result shows the exact observations, audit URL and time. These signals are a reason to review the site manually, not proof that the owner wants a redesign. The business phone is rechecked on its own site when searched. `scripts/audit_opportunities.mjs` and `scripts/build_opportunities.mjs` refresh the audit and CSV.

**No website listed** contains 147 separate Overture records with a phone and social profile but no website in that source record. This is a research queue, not a verified-contact list. The phone and profile may be stale or wrong, and a website might exist elsewhere. `scripts/build_no_site.py` rebuilds that queue from the Overture download. The UI and CSV mark these distinctions; do not pitch them as confirmed no-website businesses without further checks.

These checks prove that the web page responded and published the listed phone at the displayed check time. They do **not** prove that a call or SMS is delivered, the business is still open today, or the business is profitable or growing. Overture's confidence describes existence, not sales quality. Overture itself [documents duplicates and property errors](https://docs.overturemaps.org/guides/places/), so a user should review a lead before outreach. Email is omitted unless sourced and checked. The date of the source data and current check time are visible in the API response or detail panel.

`GET /api/leads?meta=true` returns niches, areas, and catalog size. `GET /api/leads?type=All%20niches&area=Greater%20Memphis%20area&limit=25&offset=0` searches the catalog and live-checks each candidate on that page. `nextOffset` drives **Load more**. Searches are mixed across niches when All niches is selected. Saved leads remain in browser local storage. The dated CSV under `public/` is a bulk snapshot with its original check times; use the interactive search for a new check at viewing time.

## Refreshing the catalog

Install Python 3.12+ and `pip install -r scripts/requirements.txt`. Create `work/catalog` and download an area extract with:

```
python -m overturemaps download --bbox=-90.45,34.65,-89.65,35.32 -f geojsonseq -t place -r 2026-09-23.1 -o work/catalog/memphis-places.geojsonseq
python scripts/select_places.py
python scripts/verify_places.py
python scripts/verify_contact_pages.py
python scripts/package_leads.py
```

For a new release, update the release ID in the download command, `scripts/select_places.py`, and the API metadata. Clear the three verification JSONL files in ignored `work/catalog` before regenerating to ensure every record receives a fresh check. Review category and city mappings when the Overture taxonomy changes. The inclusion script excludes sources with licenses other than CDLA Permissive 2.0; Overture Places records in this catalog come from Meta and other CDLA contributors. [Attribution and licensing](https://docs.overturemaps.org/attribution/).

Run `npm ci`, `node --experimental-strip-types --test app/api/leads/validation.test.mjs`, and `npm run build`. The app has no paid provider or API key requirement.
