import { officialLeads } from "./sources";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Tags = Record<string, string>;
type Element = { type: "node" | "way" | "relation"; id: number; tags?: Tags };
type Lead = {
  id: string; name: string; type: string; place: string; website: string;
  phone: string | null; email: string | null; score: number; source: string;
  why: string; stage: string; next: string;
};

const areas: Record<string, [number, number, number]> = {
  "Memphis, TN": [35.1495, -90.049, 17000],
  "Southaven, MS": [34.98898, -90.01259, 14000],
  "Olive Branch, MS": [34.96176, -89.82953, 14000],
  "Horn Lake, MS": [34.95537, -90.03481, 14000],
  "Tunica, MS": [34.68455, -90.38288, 22000],
  "North Mississippi": [34.95537, -90.03481, 40000]
};
const categories: Record<string, string[]> = {
  "Barbershops": ['["shop"="hairdresser"]', '["shop"="barber"]'],
  "Beauty salons": ['["shop"="beauty"]', '["beauty"="salon"]'],
  "Landscaping": ['["craft"="gardener"]', '["craft"="landscaper"]'],
  "Remodeling": ['["craft"~"carpenter|builder|painter|roofer"]']
};
const providers = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter"
];
const str = (value?: string) => (value || "").trim();

function normalizeWebsite(value: string): string | null {
  if (!value) return null;
  const first = value.split(";")[0].trim();
  try {
    const url = new URL(/^https?:\/\//i.test(first) ? first : "https://" + first);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch { return null; }
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
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        signal: controller.signal,
        cache: "no-store"
      });
      if (!response.ok) { failures.push(String(response.status)); continue; }
      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null || !("elements" in data) || !Array.isArray(data.elements)) {
        failures.push("Invalid response"); continue;
      }
      return data.elements as Element[];
    } catch (error) {
      failures.push(error instanceof Error ? error.name : "Network error");
    } finally { clearTimeout(timer); }
  }
  throw new Error("All public-directory servers were unavailable (" + failures.join(", ") + ").");
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "Barbershops";
  const area = request.nextUrl.searchParams.get("area") || "North Mississippi";
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.floor(rawLimit))) : 10;
  if (!Object.hasOwn(areas, area) || !Object.hasOwn(categories, type)) {
    return NextResponse.json({ error: "Choose a supported business type and location." }, { status: 400 });
  }

  const [lat, lon, radius] = areas[area];
  const selectors = categories[type].map(tag => `nwr(around:${radius},${lat},${lon})${tag};`).join("");
  const query = `[out:json][timeout:18];(${selectors});out tags 500;`;

  try {
    const official = await officialLeads(type, area);
    let elements: Element[] = [];
    let directoryUnavailable = false;
    // Directory-only records are opt-in and never mixed with contact-checked results by default.
    if (request.nextUrl.searchParams.get("includeUnverified") === "true") {
      try { elements = await discover(query); } catch { directoryUnavailable = true; }
    }
    const seen = new Set<string>();
    const results: Lead[] = [];

    for (const element of elements) {
      const t = element.tags || {};
      const name = str(t.name);
      const website = normalizeWebsite(str(t.website || t["contact:website"] || t.url));
      const phone = str(t.phone || t["contact:phone"] || t.mobile);
      const email = str(t.email || t["contact:email"]);
      if (!name || !website || (!phone && !email)) continue;

      const hostname = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
      const dedupeKey = hostname + "|" + name.toLowerCase().replace(/\s+/g, "");
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const completeness = Math.min(100, 50 + Number(!!phone) * 10 + Number(!!email) * 10 +
        Number(!!t["addr:street"]) * 10 + Number(!!t.opening_hours) * 5);
      results.push({
        id: element.type + "/" + element.id, name, type,
        place: str(t["addr:city"]) || area,
        website, phone: phone || null, email: email || null, score: completeness,
        source: "https://www.openstreetmap.org/" + element.type + "/" + element.id,
        why: "Public listing includes a website and contact method. Business activity, website quality, and contact accuracy still need verification.",
        stage: "Researching", next: "Verify business"
      });
    }

    results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return NextResponse.json({
      leads: [...official.leads, ...results.map(l=>({...l,verification:"unverified",checkedAt:null}))].slice(0, limit),
      found: official.leads.length + results.length,
      coverage: { mode: "limited-official-source-registry", attempted: official.attempted, excluded: official.failed, directoryUnavailable },
      source: "Official business websites; optional directory records © OpenStreetMap contributors",
      notice: "Limited researched source coverage. Only official sites that currently display the listed phone are included by default. Published contact does not prove the number works, supports SMS, or that the business is active. Fewer than the requested maximum may be available."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lead discovery failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: "The public business directory is unavailable right now. Try again shortly or choose another area. No sample businesses were substituted."
    }, { status: 503 });
  }
}
