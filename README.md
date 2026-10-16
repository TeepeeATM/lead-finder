# Cairvant Lead Finder

Search defaults to a limited, researched registry of official business websites. Every request fetches matching sources concurrently (6.5-second timeout each), requires the researched business identity and exact published phone in visible page text, and excludes failures or mismatches. There are no sample records, generated contacts, or cached contacts substituted on failure. Coverage is intentionally incomplete; an empty search is valid, especially Horn Lake and Tunica where no sources have been researched yet. Service areas are labeled separately from physical locations.

`verification: published-contact` confirms only that the official source responded and displayed that number at `checkedAt`. It does not verify phone deliverability, ownership, SMS support, current business activity, or sales suitability. Emails are omitted unless independently sourced. Scores retain the original completeness scale (50 for website + 10 for phone), not purchase likelihood.

`GET /api/leads?type=Barbershops&area=North%20Mississippi&limit=10`

Optional `includeUnverified=true` also requests OpenStreetMap directory listings. These carry `verification: unverified`, and remain disabled in the UI. An Overpass outage does not discard official-source results. Default searches do not depend on Overpass. The `coverage` response explains source checks/exclusions. Unsupported filters return 400; successful searches with zero matches return 200. No API key is required.

To expand coverage, research an official website, phone, identity and location/service area, then add it to `app/api/leads/sources.ts`. Never infer contacts or service coverage. Keep source URLs code-controlled to prevent arbitrary server-side fetching.

Run `npm ci`, `node --experimental-strip-types --test app/api/leads/sources.test.mjs`, and `npm run build`. Tests cover exact phone/identity matching, script-only rejection, source outages, changed contacts and uncovered locations. `npm run dev` starts the UI. Saved leads remain local to the browser and their check timestamps may become stale.
