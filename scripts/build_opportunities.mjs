import fs from 'node:fs/promises';

const leads = JSON.parse(await fs.readFile('app/data/leads.json', 'utf8'));
const audits = JSON.parse(await fs.readFile('work/catalog/site-audit.json', 'utf8'));
const byId = new Map(leads.map(lead => [lead.id, lead]));
const seen = new Set();
const opportunities = audits.filter(audit => audit.issueCount >= 2).flatMap(audit => {
  const lead = byId.get(audit.id);
  if (!lead || seen.has(lead.phone)) return [];
  seen.add(lead.phone);
  return [{ ...lead, audit: { checkedUrl: audit.checkedUrl, checkedAt: audit.checkedAt, issues: audit.issues } }];
});
opportunities.sort((a, b) => b.audit.issues.length - a.audit.issues.length || a.niche.localeCompare(b.niche) || a.name.localeCompare(b.name));
await fs.writeFile('app/data/opportunities.json', JSON.stringify(opportunities, null, 2) + '\n');
const csv = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const columns = ['name','niche','city','state','website','phone','contactSource','auditUrl','auditCheckedAt','issues','contactCheckedAt'];
const lines = [columns.map(csv).join(',')];
for (const row of opportunities) lines.push([
  row.name,row.niche,row.city,row.state,row.website,"'" + row.phone,row.contactSource,
  row.audit.checkedUrl,row.audit.checkedAt,row.audit.issues.join('; '),row.catalogCheckedAt
].map(csv).join(','));
await fs.writeFile('public/website-opportunities-2026-10-22.csv', lines.join('\r\n') + '\r\n');
console.log(`${opportunities.length} distinct businesses with at least two visible site issues`);
