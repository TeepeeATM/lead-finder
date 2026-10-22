import fs from 'node:fs/promises';

const leads = JSON.parse(await fs.readFile('app/data/leads.json', 'utf8'));
const sites = [...new Map(leads.map(lead => [lead.website, lead])).values()];
const results = [];
let cursor = 0;

function analyze(html, finalUrl) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || html.slice(0, 50000);
  const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]*>/g, '').trim() || '';
  const descriptionTag = [...head.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0]).find(tag => /\bname\s*=\s*["']?description\b/i.test(tag));
  const description = descriptionTag?.match(/\bcontent\s*=\s*["']([^"']*)/i)?.[1]?.trim() || '';
  const viewport = /<meta\b(?=[^>]*name\s*=\s*["']?viewport\b)[^>]*>/i.test(head);
  const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)].map(x => x[1]);
  const issues = [];
  if (!viewport) issues.push('No mobile viewport tag on the checked page');
  if (!title || /^(home|homepage|index|welcome)$/i.test(title)) issues.push('Missing or generic page title');
  if (!description) issues.push('No search description on the checked page');
  if (!links.some(link => /(?:^|[\/#?_-])(contact|quote|estimate|book|appointment|schedule)(?:[\/#?_-]|$)/i.test(link))) issues.push('No dedicated contact, booking or quote link found in fetched HTML');
  return { title, description, viewport, issueCount: issues.length, issues, checkedUrl: finalUrl };
}

async function worker() {
  while (cursor < sites.length) {
    const lead = sites[cursor++];
    try {
      const response = await fetch(lead.website, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CairvantSiteAudit/1.0)' } });
      const type = response.headers.get('content-type') || '';
      if (!response.ok || !type.includes('text/html') || Number(response.headers.get('content-length') || 0) > 2_000_000) continue;
      const html = (await response.text()).slice(0, 2_000_000);
      results.push({ id: lead.id, name: lead.name, website: lead.website, ...analyze(html, response.url), checkedAt: new Date().toISOString() });
    } catch { /* Inaccessible sites are not given a quality label. */ }
  }
}
await Promise.all(Array.from({ length: 16 }, worker));
await fs.mkdir('work/catalog', { recursive: true });
await fs.writeFile('work/catalog/site-audit.json', JSON.stringify(results, null, 2));
const counts = new Map();
for (const row of results) for (const issue of row.issues) counts.set(issue, (counts.get(issue) || 0) + 1);
console.log(JSON.stringify({ checked: results.length, issues: Object.fromEntries(counts), examples: results.filter(x => x.issueCount >= 2).slice(0, 20) }, null, 2));
