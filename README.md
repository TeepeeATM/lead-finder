# Cairvant Lead Finder — no website found

This version searches OpenStreetMap on the server rather than requiring a paid Places key or returning the old website-only catalog. The existing dashboard, browser-local saved leads and pipeline stages remain. A separate local-storage key prevents old website-owning leads from appearing in the new pipeline.

## Search flow

1. Choose a supported city and one of Barbershops, Salons, Landscapers or Remodelers. The API searches within 10 km (5/20 km also supported through the radius parameter).
2. Query a public Overpass instance, falling back to a second provider. Identical discovery requests share a promise and successful map responses are cached in memory for 15 minutes. This is best-effort instance-local caching, not durable storage.
3. Exclude map records with a standalone website, no phone/email, disused status, or an incompatible industry. Remodeling searches require a remodeling/renovation indicator, rather than relabeling every builder as a remodeler. Deduplicate by name and contact.
4. Check up to five candidates per batch with two Bing RSS web searches per candidate. No paid provider key is required. Name and exact phone must be corroborated in at least one result; every result URL must be a recognized social/directory destination. An identified standalone destination excludes the business. Empty, ambiguous, unsupported, blocked or failed responses withhold the candidate.
5. Display only `no-website-found` leads, including source URLs, search evidence and check timestamp. Phone/email source is OSM; phone corroboration is a search snippet. Email is a syntactically checked map listing, not deliverability verification. SMS and iMessage are always unverified.

`No website found` does not prove that no website exists. Search indexes and snippets can be incomplete or outdated. Generic name collisions, missing contacts and incomplete map coverage can produce few or zero qualifying results. The free Bing RSS endpoint is not a guaranteed production search API and may throttle/block requests. Failure never falls back to sample leads or labels an unverified candidate as qualified. Phone-only corroboration means email-only candidates currently remain inconclusive.

Public Overpass services are shared and can fail. This implementation does not guarantee availability; both providers failing returns HTTP 503 and the dashboard explains the failure. It does not send messages, place calls, audit arbitrary URLs, or contact businesses.

## API

`GET /api/leads?meta=true` returns industries and supported cities.

`GET /api/leads?type=Barbershops&area=Memphis%2C%20TN&limit=5&offset=0`

The response includes `leads`, map candidate count (`found`), `checked`, `excluded`, `verificationFailures`, and `nextOffset`. Counts are candidates, never a promise of qualified leads. `radius` accepts 5000, 10000 or 20000 metres. `limit` is capped at 5 to bound upstream traffic and function duration. Pagination reuses the short map cache; it is best effort if map data changes between requests.

## Run and check

```
npm ci
node --experimental-strip-types --test app/lib/discovery.test.mjs app/api/leads/validation.test.mjs
npm run build
npm start
```

The legacy static catalog and scripts remain for provenance but are not used by the no-website discovery endpoint. Its old CSV is no longer offered in the dashboard.

Keep the existing Vercel project and Deployment Protection enabled. Use the protected deployment URL for the private workspace. Do not change the access audience or contact prospects as part of deployment.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Public Overpass instances: https://wiki.openstreetmap.org/wiki/Overpass_API . No map autocomplete or public Nominatim requests are made.

For explicit live-provider verification after building: `node scripts/live-smoke.mjs`. This starts the built API on localhost, runs four real Memphis searches, logs only counts/status, and exits unsuccessfully if map discovery fails. Zero qualified leads remains a valid empty result, not proof of useful lead availability.
