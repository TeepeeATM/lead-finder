import { officialLeads } from "./sources";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Tags = Record<string, string>;
type Element = { type: "node" | "way" | "relation"; id: number; tags?: Tags };
type Lead = {
  id: string;
  name: string;
  type: string;
  place: string;
  website: string;
  phone: string | null;
  email: string | null;
  score: number;
  source: string;
  why: string;
  stage: string;
  next: string;
};

const areas: Record<string, [number, number, number]> = {
  "Memphis, TN": [35.1495, -90.049, 17000],
  "Southaven, MS": [34.98898, -90.01259, 14000],
  "Olive Branch, MS": [34.96176, -89.82953, 14000],
  "Horn Lake, MS": [34.95537, -90.03481, 14000],
  "Tunica, MS": [34.68455, -90.38288, 22000],
  "North Mississippi": [34.95537, -90.03481, 40000],
};
const categories: Record<string, string[]> = {
  Barbershops: ['["shop"="hairdresser"]', '["shop"="barber"]'],
  "Beauty salons": ['["shop"="beauty"]', '["beauty"="salon"]'],
  Landscaping: [
    '["craft"="gardener"]',
    '["craft"="landscaper"]',
    '["service"="landscaping"]',
    '["name"~"landscap|lawn care|lawn service|tree service|yard service",i]',
  ],
  Remodeling: ['["craft"~"carpenter|builder|painter|roofer"]'],
  Roofing: ['["craft"="roofer"]', '["name"~"roofing|roofer",i]'],
  Plumbing: ['["craft"="plumber"]', '["name"~"plumbing|plumber",i]'],
  Electricians: [
    '["craft"="electrician"]',
    '["name"~"electric|electrical|electrician",i]',
  ],
  HVAC: [
    '["craft"~"hvac|heating_engineer"]',
    '["name"~"HVAC|heating and air|air conditioning",i]',
  ],
  "Auto repair": ['["shop"="car_repair"]'],
  "Cleaning services": [
    '["craft"="cleaner"]',
    '["office"="cleaning"]',
    '["name"~"cleaning|cleaners|maid service",i]',
  ],
  Dentists: ['["amenity"="dentist"]'],
  Restaurants: ['["amenity"="restaurant"]'],
};
const providers = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];
const str = (value?: string) => (value || "").trim();

function normalizeWebsite(value: string): string | null {
  if (!value) return null;
  const first = value.split(";")[0].trim();
  try {
    const url = new URL(
      /^https?:\/\//i.test(first) ? first : "https://" + first,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname.includes(".")
    )
      return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function discover(query: string): Promise<Element[]> {
  const failures: string[] = [];
  for (const provider of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(provider, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        failures.push(String(response.status));
        continue;
      }
      const data: unknown = await response.json();
      if (
        typeof data !== "object" ||
        data === null ||
        !("elements" in data) ||
        !Array.isArray(data.elements)
      ) {
        failures.push("Invalid response");
        continue;
      }
      return data.elements as Element[];
    } catch (error) {
      failures.push(error instanceof Error ? error.name : "Network error");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(
    "All public-directory servers were unavailable (" +
      failures.join(", ") +
      ").",
  );
}

function digits(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function visibleText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ");
}

async function verifyDirectoryLead(
  element: Element,
  type: string,
  area: string,
): Promise<Lead | null> {
  const t = element.tags || {};
  const name = str(t.name);
  const website = normalizeWebsite(
    str(t.website || t["contact:website"] || t.url),
  );
  const phone = str(t.phone || t["contact:phone"] || t.mobile);
  const listedEmail = str(t.email || t["contact:email"]);
  if (!name || !website || (!phone && !listedEmail)) return null;

  try {
    const response = await fetch(website, {
      signal: AbortSignal.timeout(4500),
      cache: "no-store",
      redirect: "follow",
      headers: { Accept: "text/html", "User-Agent": "CairvantLeadFinder/1.0" },
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/html")
    )
      return null;
    const text = visibleText(await response.text());
    const phoneConfirmed =
      !!phone &&
      digits(phone).length === 10 &&
      text.replace(/\D/g, "").includes(digits(phone));
    const emailMatches =
      text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    const email =
      listedEmail ||
      emailMatches.find(
        (value) => !/example\.|sentry\.|wixpress\./i.test(value),
      ) ||
      "";
    const emailConfirmed =
      !!email && text.toLowerCase().includes(email.toLowerCase());
    if (!phoneConfirmed && !emailConfirmed) return null;

    const completeness = Math.min(
      100,
      60 +
        Number(phoneConfirmed) * 15 +
        Number(emailConfirmed) * 15 +
        Number(!!t["addr:street"]) * 5 +
        Number(!!t.opening_hours) * 5,
    );
    return {
      id: element.type + "/" + element.id,
      name,
      type,
      place: str(t["addr:city"]) || area,
      website,
      phone: phoneConfirmed ? phone : null,
      email: emailConfirmed ? email : null,
      score: completeness,
      source: website,
      why: "Official website responded and displayed at least one listed contact method during this search.",
      stage: "Researching",
      next: "Review and contact",
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "Barbershops";
  const area = request.nextUrl.searchParams.get("area") || "North Mississippi";
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
    : 10;
  if (!Object.hasOwn(areas, area) || !Object.hasOwn(categories, type)) {
    return NextResponse.json(
      { error: "Choose a supported business type and location." },
      { status: 400 },
    );
  }

  const [lat, lon, radius] = areas[area];
  const selectors = categories[type]
    .map((tag) => `nwr(around:${radius},${lat},${lon})${tag};`)
    .join("");
  const query = `[out:json][timeout:18];(${selectors});out tags 500;`;

  try {
    const official = await officialLeads(type, area);
    let elements: Element[] = [];
    let directoryUnavailable = false;
    try {
      elements = await discover(query);
    } catch {
      directoryUnavailable = true;
    }
    const seen = new Set<string>();
    const candidates = elements
      .filter((element) => {
        const t = element.tags || {};
        const website = normalizeWebsite(
          str(t.website || t["contact:website"] || t.url),
        );
        return (
          !!str(t.name) &&
          !!website &&
          !!str(
            t.phone ||
              t["contact:phone"] ||
              t.mobile ||
              t.email ||
              t["contact:email"],
          )
        );
      })
      .slice(0, Math.max(limit * 3, 75));
    const checked = await Promise.all(
      candidates.map((element) => verifyDirectoryLead(element, type, area)),
    );
    const results: Lead[] = [];
    for (const lead of checked) {
      if (!lead) continue;
      const hostname = new URL(lead.website).hostname
        .replace(/^www\./, "")
        .toLowerCase();
      if (seen.has(hostname)) continue;
      seen.add(hostname);
      results.push(lead);
    }

    results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return NextResponse.json(
      {
        leads: [
          ...official.leads,
          ...results.map((l) => ({
            ...l,
            verification: "published-contact",
            checkedAt: new Date().toISOString(),
          })),
        ]
          .filter(
            (lead, index, all) =>
              all.findIndex(
                (other) =>
                  new URL(other.website).hostname.replace(/^www\./, "") ===
                  new URL(lead.website).hostname.replace(/^www\./, ""),
              ) === index,
          )
          .slice(0, limit),
        found: official.leads.length + results.length,
        coverage: {
          mode: "live-directory-plus-official-site-check",
          attempted: official.attempted + candidates.length,
          excluded: official.failed + candidates.length - results.length,
          directoryUnavailable,
        },
        source:
          "Official business websites; optional directory records © OpenStreetMap contributors",
        notice:
          "Live public listings are checked against each business website. Only records whose website currently displays the listed phone or email are shown. Published contact does not guarantee deliverability or business activity, so review each lead before outreach.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Lead discovery failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        error:
          "The public business directory is unavailable right now. Try again shortly or choose another area. No sample businesses were substituted.",
      },
      { status: 503 },
    );
  }
}
