"use client";
import { useEffect, useState } from "react";
import {
  HomeIcon,
  MagnifyingGlassIcon,
  UsersIcon,
  ArrowTopRightOnSquareIcon,
  BookmarkIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
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
  verification?: string;
  checkedAt?: string;
  stage?: string;
};
const types = [
  "Barbershops",
  "Beauty salons",
  "Landscaping",
  "Remodeling",
  "Roofing",
  "Plumbing",
  "Electricians",
  "HVAC",
  "Auto repair",
  "Cleaning services",
  "Dentists",
  "Restaurants",
];
const areas = [
  "North Mississippi",
  "Memphis, TN",
  "Southaven, MS",
  "Olive Branch, MS",
  "Horn Lake, MS",
  "Tunica, MS",
];
const stages = [
  "Researching",
  "Ready",
  "Contacted",
  "Interested",
  "Proposal",
  "Won",
  "Not a fit",
];
const nav = [
  ["Overview", HomeIcon],
  ["Find leads", MagnifyingGlassIcon],
  ["My leads", UsersIcon],
] as const;
export default function Home() {
  const [active, setActive] = useState("Overview"),
    [saved, setSaved] = useState<Lead[]>([]),
    [ready, setReady] = useState(false);
  const [type, setType] = useState(types[0]),
    [area, setArea] = useState(areas[0]),
    [limit, setLimit] = useState("10");
  const [results, setResults] = useState<Lead[]>([]),
    [loading, setLoading] = useState(false),
    [searched, setSearched] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null),
    [filter, setFilter] = useState("All");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cairvant-leads-v1");
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("cairvant-leads-v1", JSON.stringify(saved));
  }, [saved, ready]);
  async function search() {
    setLoading(true);
    setError("");
    setNotice("");
    setSearched(false);
    setResults([]);
    try {
      const r = await fetch(
        "/api/leads?" + new URLSearchParams({ type, area, limit }),
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Discovery unavailable");
      setNotice(d.notice || "");
      setResults(d.leads || []);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }
  function save(l: Lead) {
    setSaved((p) =>
      p.some((x) => x.id === l.id) ? p : [{ ...l, stage: "Researching" }, ...p],
    );
  }
  function stage(id: string, value: string) {
    setSaved((p) => p.map((l) => (l.id === id ? { ...l, stage: value } : l)));
    setSelected((p) => (p?.id === id ? { ...p, stage: value } : p));
  }
  const readyCount = saved.filter((l) => l.stage === "Ready").length;
  const contacted = saved.filter((l) =>
    ["Contacted", "Interested", "Proposal", "Won"].includes(l.stage || ""),
  ).length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">C</div>
          <div>
            <strong>Cairvant</strong>
            <small>LEAD FINDER</small>
          </div>
        </div>
        <div className="navLabel">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(([n, Icon]) => (
            <button
              key={n}
              className={active === n ? "active" : ""}
              onClick={() => {
                setActive(n);
                setSelected(null);
              }}
            >
              <Icon />
              {n}
            </button>
          ))}
        </nav>
        <div className="sideFoot">
          <span className="liveDot" />
          Private workspace <p>Lead records are stored in this browser only.</p>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="breadcrumb">
            Cairvant <span>/</span> {active}
          </div>
          <div className="topRight">
            <span className="avatar">CV</span>
          </div>
        </header>
        <div className="pageHead">
          <div>
            <p className="eyebrow">LEAD ACQUISITION</p>
            <h1>
              {active === "Overview"
                ? "Your workspace"
                : active === "Find leads"
                  ? "Discover businesses"
                  : "Saved prospects"}
            </h1>
            <p className="subtitle">
              {active === "Overview"
                ? "A clear view of your next outreach actions."
                : active === "Find leads"
                  ? "Search real public business listings and review matches."
                  : "Track businesses you've chosen to research and contact."}
            </p>
          </div>
          <button className="primary" onClick={() => setActive("Find leads")}>
            <MagnifyingGlassIcon /> Find leads
          </button>
        </div>
        {active === "Overview" && (
          <>
            <div className="stats">
              <div>
                <span>Saved prospects</span>
                <strong>{saved.length}</strong>
                <small>In this browser</small>
              </div>
              <div>
                <span>Ready to contact</span>
                <strong>{readyCount}</strong>
                <small>Manually reviewed</small>
              </div>
              <div>
                <span>Contacted or further</span>
                <strong>{contacted}</strong>
                <small>Pipeline progress</small>
              </div>
            </div>
            <div className="sectionTitle">
              <div>
                <h2>What to do next</h2>
                <p>Three simple steps to keep your pipeline moving.</p>
              </div>
            </div>
            <div className="steps">
              <button onClick={() => setActive("Find leads")}>
                <span className="stepNo">01</span>
                <div>
                  <strong>Find businesses</strong>
                  <p>
                    Choose an industry and location, then search public
                    listings.
                  </p>
                </div>
                <span className="arrow">↗</span>
              </button>
              <button onClick={() => setActive("My leads")}>
                <span className="stepNo">02</span>
                <div>
                  <strong>Review your prospects</strong>
                  <p>Open their website and verify their contact details.</p>
                </div>
                <span className="arrow">↗</span>
              </button>
              <button onClick={() => setActive("My leads")}>
                <span className="stepNo">03</span>
                <div>
                  <strong>Track your outreach</strong>
                  <p>
                    Update each business as you research, contact, and follow
                    up.
                  </p>
                </div>
                <span className="arrow">↗</span>
              </button>
            </div>
            <div className="info">
              <CheckCircleIcon />
              <p>
                <strong>No invented lead scores.</strong> Discovery results
                reflect directory completeness, not website quality or
                likelihood to buy.
              </p>
            </div>
          </>
        )}
        {active === "Find leads" && (
          <>
            <section className="panel">
              <div className="panelHeading">
                <div>
                  <h2>New search</h2>
                  <p>
                  Choose an industry and location. Live directory matches are
                  checked against each business&apos;s official website before
                  they appear.
                  </p>
                </div>
              </div>
              <div className="fields">
                <label>
                  Business type
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {types.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    {areas.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Maximum results
                  <select
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  >
                    {["10", "25", "50"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <button className="primary" disabled={loading} onClick={search}>
                  {loading ? (
                    <ArrowPathIcon className="spin" />
                  ) : (
                    <MagnifyingGlassIcon />
                  )}
                  {loading ? "Searching…" : "Search businesses"}
                </button>
              </div>
            </section>
            {error && (
              <div className="notice error">
                <strong>Search unavailable.</strong> {error}
              </div>
            )}
            {loading && (
              <div className="empty">
                <ArrowPathIcon className="spin" />
                <h3>Searching public business listings</h3>
                <p>This may take a few seconds.</p>
              </div>
            )}
            {searched && (
              <>
                {notice && <div className="notice">{notice}</div>}
                <div className="sectionTitle">
                  <div>
                    <h2>
                      Search results{" "}
                      <span className="count">{results.length}</span>
                    </h2>
                    <p>
                      Review each record before adding it to your outreach list.
                    </p>
                  </div>
                </div>
                <div className="results">
                  {results.map((l) => (
                    <article className="result" key={l.id}>
                      <div className="resultBody">
                        <div className="resultTitle">
                          <h3>{l.name}</h3>
                          <span className="pill">
                            {l.verification === "published-contact"
                              ? "Contact published"
                              : "Unverified"}
                          </span>
                        </div>
                        <p className="muted">
                          {l.type} · {l.place}
                        </p>
                        <div className="detailLine">
                          <span>Official website + listed phone checked</span>
                          <span>Data completeness: {l.score}/100</span>
                        </div>
                      </div>
                      <div className="resultActions">
                        <button
                          className="secondary"
                          onClick={() => setSelected(l)}
                        >
                          View details
                        </button>
                        <button
                          className="primary"
                          disabled={saved.some((x) => x.id === l.id)}
                          onClick={() => save(l)}
                        >
                          <BookmarkIcon />
                          {saved.some((x) => x.id === l.id)
                            ? "Saved"
                            : "Save lead"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {!results.length && (
                  <div className="empty">
                    <h3>No qualifying listings found</h3>
                    <p>
                      Try another location or business type. We won't substitute
                      fictional businesses.
                    </p>
                  </div>
                )}
              </>
            )}
            {!searched && !loading && !error && (
              <div className="empty">
                <MagnifyingGlassIcon />
                <h3>Ready to find your next prospect?</h3>
                <p>Choose your filters above and select Search businesses.</p>
              </div>
            )}
          </>
        )}
        {active === "My leads" && (
          <>
            <div className="sectionTitle savedHead">
              <div>
                <h2>
                  My leads <span className="count">{saved.length}</span>
                </h2>
                <p>
                  These are leads you saved, not independently audited
                  businesses.
                </p>
              </div>
              <label className="filterLabel">
                Stage{" "}
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {["All", ...stages].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="results">
              {saved
                .filter((l) => filter === "All" || l.stage === filter)
                .map((l) => (
                  <article className="result" key={l.id}>
                    <div className="resultBody">
                      <div className="resultTitle">
                        <h3>{l.name}</h3>
                        <span className="pill">{l.stage}</span>
                      </div>
                      <p className="muted">
                        {l.type} · {l.place}
                      </p>
                    </div>
                    <div className="resultActions">
                      <button
                        className="secondary"
                        onClick={() => setSelected(l)}
                      >
                        Open lead
                      </button>
                      <select
                        aria-label={"Stage for " + l.name}
                        value={l.stage}
                        onChange={(e) => stage(l.id, e.target.value)}
                      >
                        {stages.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
            </div>
            {saved.length === 0 && (
              <div className="empty">
                <UsersIcon />
                <h3>No saved leads yet</h3>
                <p>Find a business, review its details, and save it here.</p>
                <button
                  className="primary"
                  onClick={() => setActive("Find leads")}
                >
                  Find leads
                </button>
              </div>
            )}
          </>
        )}
        <footer className="footer">
          Cairvant Lead Finder · Directory records require independent
          verification · No automated outreach
        </footer>
      </main>
      {selected && (
        <div className="modalBackdrop" onClick={() => setSelected(null)}>
          <section
            className="detailPanel"
            role="dialog"
            aria-modal="true"
            aria-label="Lead details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="detailHeader">
              <span className="eyebrow">BUSINESS PROFILE</span>
              <button
                className="close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <h2>{selected.name}</h2>
            <p className="muted">
              {selected.type} · {selected.place}
            </p>
            <div className="notice">
              <strong>
                {selected.verification === "published-contact"
                  ? "Published contact checked"
                  : "Verification needed"}
              </strong>
              <p>{selected.why}</p>
              {selected.checkedAt && (
                <p>
                  Source checked:{" "}
                  {new Date(selected.checkedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="facts">
              <div>
                <span>Website</span>
                <a
                  href={selected.website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open website <ArrowTopRightOnSquareIcon />
                </a>
              </div>
              <div>
                <span>Phone</span>
                <strong>{selected.phone || "Not listed"}</strong>
                <small>SMS / iMessage unverified</small>
              </div>
              <div>
                <span>Email</span>
                <strong>{selected.email || "Not listed"}</strong>
              </div>
              <div>
                <span>Contact source</span>
                <a
                  href={selected.source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View original source <ArrowTopRightOnSquareIcon />
                </a>
              </div>
              <div>
                <span>Record completeness</span>
                <strong>{selected.score}/100</strong>
                <small>Not a purchase-likelihood score</small>
              </div>
            </div>
            <button
              className="primary wide"
              disabled={saved.some((x) => x.id === selected.id)}
              onClick={() => save(selected)}
            >
              <BookmarkIcon />
              {saved.some((x) => x.id === selected.id)
                ? "Already saved"
                : "Save to my leads"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
