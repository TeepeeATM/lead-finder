# Cairvant Lead Finder

Lead Finder focuses on three buyer groups for a website-redesign offer: home-service trades, auto services, and property services. The October 21, 2026 [Overture Maps Places](https://docs.overturemaps.org/guides/places/) release supplies regional TN/MS/AR place records. The site displays 92 businesses with an observed website issue as its primary list. A separate 564-business catalog passed a published-phone check on the business website. Another 345 records have a phone and social profile but no website in the Overture record; those are **unverified research prospects**, not confirmed contacts or proof that a website does not exist elsewhere.

Every displayed website-fix prospect has a site page that was fetched during the batch audit. Its listed phone and business identity were found on its website during collection, and the API rechecks the published phone at search time. The opportunity signals are missing mobile viewport metadata, a missing or generic title, or no dedicated contact/booking/quote URL in the fetched HTML. Missing search descriptions are shown as supporting context but are not enough by themselves for a redesign prospect. These are cues for human review, not evidence that an owner wants to buy. Source confidence measures place existence only; it does not establish phone deliverability, revenue, or current success. The API excludes a website prospect if its published contact fails the fresh check.

The search has three modes: **Website fixes** (default), **No website listed** (research only), and **All listings** (the broader contact-checked catalog). Results are mixed across the three buyer groups when all groups are selected. Filters support state and towns with sufficient records. The dated source release and audit/check times are included with records. Saved leads stay in browser local storage. CSV exports under `public/` retain the evidence URLs and distinguish directory-only phone numbers from website-published numbers.

## Free batch refresh

Install Python 3.12+, Node.js, and the repository dependencies:

```sh
python -m pip install -r scripts/requirements.txt
npm ci
python scripts/refresh_targeted.py
```

The refresh command discovers the current release from [Overture's STAC catalog](https://docs.overturemaps.org/getting-data/), downloads only the configured bounding box, selects ten relevant trades, verifies public websites and exact published phone numbers concurrently, checks contact pages, audits site HTML, deduplicates, and rebuilds the JSON and CSV files. The current extract covers `-90.9,34.2,-88.9,36.0`; `--bbox=xmin,ymin,xmax,ymax` changes the region. `--reuse-source` avoids another download when its release and bounding box match. The source and intermediate files live in ignored `work/catalog/`. Review generated records before committing or deploying; the command never auto-publishes. It uses no paid API or live Overpass instance. Overture's [Python client](https://docs.overturemaps.org/getting-data/overturemaps-py/) reads only the selected region, but your internet transfer and local runtime still have costs.

The selection keeps only CDLA Permissive 2.0 place records, excludes directory/social domains from the website field, requires a listed-open status and a valid phone, and uses source existence confidence of at least 0.90 before independent site checks. [Overture documents known duplicates, junk, and incomplete properties](https://docs.overturemaps.org/guides/places/). No-site research records must be checked manually before outreach. See [attribution and licensing](https://docs.overturemaps.org/attribution/).

Run `node --experimental-strip-types --test app/api/leads/validation.test.mjs` and `npm run build` after refreshing. Then test `/api/leads?meta=true` and a paged search on the deployed site.
