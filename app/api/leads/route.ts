import { NextRequest, NextResponse } from 'next/server';
import catalog from '../../data/leads.json';
import opportunities from '../../data/opportunities.json';
import noSite from '../../data/no-site.json';
import { checkPublishedContact } from './validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Candidate = { id:string; name:string; niche:string; city:string; state:string; website:string; phone:string; contactSource:string; catalogCheckedAt:string; confidence:number; release:string; audit?:{checkedUrl:string;checkedAt:string;issues:string[];priority?:string} };
type NoSite = { id:string; name:string; niche:string; city:string; state:string; address:string|null; phone:string; social:string; confidence:number; release:string };
const leads = catalog as Candidate[];
const release = leads[0]?.release || 'unknown';
const websiteFixes = opportunities as Candidate[];
const missingSites = noSite as NoSite[];
const types = ['All target businesses','Home-service trades','Auto services','Property services'];
const cityCounts = new Map<string,number>();
for(const row of leads){const key=`${row.city}, ${row.state}`;cityCounts.set(key,(cityCounts.get(key)||0)+1)}
const areas = ['Regional coverage (TN/MS/AR)','Tennessee','Mississippi','Arkansas', ...Array.from(cityCounts).filter(([,count])=>count>=10).map(([city])=>city).sort()];
function focus(niche:string){
  if(niche==='Auto repair')return 'Auto services';
  if(['Landscaping & lawn care','Cleaning services','Pest control'].includes(niche))return 'Property services';
  return 'Home-service trades';
}
const focusCounts = Object.fromEntries(Object.entries({
  'Website fixes': websiteFixes,
  'No website listed': missingSites,
  'All listings': leads,
}).map(([mode,rows])=>[mode,Object.fromEntries(types.slice(1).map(type=>[type,rows.filter(row=>focus(row.niche)===type).length]))]));

function mixedOrder<T extends {niche:string}>(rows:T[]) {
  const groups = new Map<string,T[]>();
  for (const row of rows) {const key=focus(row.niche);groups.set(key,[...(groups.get(key)||[]),row])}
  const ordered:T[]=[];
  while (groups.size) for (const [name,group] of groups) {
    const row=group.shift();if(row)ordered.push(row);
    if(!group.length)groups.delete(name);
  }
  return ordered;
}

export async function GET(request:NextRequest) {
  const p=request.nextUrl.searchParams;
  if(p.get('meta')==='true') return NextResponse.json({types,areas,catalogued:leads.length,websiteFixes:websiteFixes.length,noWebsiteListed:missingSites.length,focusCounts,release},{headers:{'Cache-Control':'public, max-age=3600'}});
  const mode=p.get('mode')||'Website fixes';
  if(!['Website fixes','No website listed','All listings'].includes(mode))return NextResponse.json({error:'Choose a supported opportunity type.'},{status:400});
  const type=p.get('type')||'All target businesses';
  const area=p.get('area')||'Regional coverage (TN/MS/AR)';
  if(!types.includes(type)||!areas.includes(area))return NextResponse.json({error:'Choose a supported niche and location.'},{status:400});
  const rawLimit=Number(p.get('limit')||25),rawOffset=Number(p.get('offset')||0);
  const limit=Number.isFinite(rawLimit)?Math.min(50,Math.max(1,Math.floor(rawLimit))):25;
  const offset=Number.isFinite(rawOffset)?Math.min(10000,Math.max(0,Math.floor(rawOffset))):0;
  const pool=mode==='Website fixes'?websiteFixes:mode==='No website listed'?missingSites:leads;
  const stateForArea:Record<string,string>={Tennessee:'TN',Mississippi:'MS',Arkansas:'AR'};
  const filtered=pool.filter(l=>(type==='All target businesses'||focus(l.niche)===type)&&(area==='Regional coverage (TN/MS/AR)'||(stateForArea[area]?l.state===stateForArea[area]:`${l.city}, ${l.state}`===area)));
  const ordered=type==='All target businesses'?mixedOrder(filtered):filtered;
  const page=ordered.slice(offset,offset+limit);
  const checked=await Promise.all(page.map(async candidate=>{
    if(mode==='No website listed'){
      const row=candidate as NoSite;
      return {id:row.id,name:row.name,type:row.niche,place:`${row.city}, ${row.state}`,website:null,phone:'+1'+row.phone,email:null,score:Math.round(row.confidence*100),source:row.social,verification:'directory-only',checkedAt:null,issues:['No website is listed in the source record'],auditUrl:null,auditCheckedAt:null,why:'Overture lists this place as open and includes a phone and social profile, but no website. The phone, social profile, and current operating status have not been independently verified. Check them before outreach.',stage:'Researching'};
    }
    const row=candidate as Candidate;
    if(!await checkPublishedContact(row))return null;
    return {id:row.id,name:row.name,type:row.niche,place:`${row.city}, ${row.state}`,website:row.website,phone:'+1'+row.phone,email:null,score:Math.round(row.confidence*100),source:row.contactSource,verification:'published-contact',checkedAt:new Date().toISOString(),issues:row.audit?.issues||[],auditUrl:row.audit?.checkedUrl||null,auditCheckedAt:row.audit?.checkedAt||null,why:mode==='Website fixes'?'The phone is published on the business website. The listed site issues were observed in the page HTML at the audit time; review the page before pitching. Phone deliverability and business growth are unverified.':'The business website responded and displayed its listed phone today. Phone deliverability and business growth are unverified.',stage:'Researching'};
  }));
  const notice=mode==='Website fixes'?'These regional prospects have a specific website issue worth reviewing for a redesign pitch. Their listed phone is rechecked on the business website during search. An audit signal is not proof that the owner wants a redesign.':mode==='No website listed'?'No website appears in the Overture source record. These are research prospects only: phone reachability, social profile ownership, and current operations are unverified.':'These are all contact-checked businesses, including polished sites. Switch to Website fixes for a focused prospect list.';
  return NextResponse.json({leads:checked.filter(x=>x!==null),found:filtered.length,checked:page.length,excluded:checked.filter(x=>x===null).length,nextOffset:offset+limit<ordered.length?offset+limit:null,source:`Overture Maps places (${release}) and public business pages`,notice},{headers:{'Cache-Control':'no-store'}});
}
