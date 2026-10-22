import { NextRequest, NextResponse } from 'next/server';
import catalog from '../../data/leads.json';
import opportunities from '../../data/opportunities.json';
import noSite from '../../data/no-site.json';
import { checkPublishedContact } from './validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Candidate = { id:string; name:string; niche:string; city:string; state:string; website:string; phone:string; contactSource:string; catalogCheckedAt:string; confidence:number; release:string; audit?:{checkedUrl:string;checkedAt:string;issues:string[]} };
type NoSite = { id:string; name:string; niche:string; city:string; state:string; address:string|null; phone:string; social:string; confidence:number; release:string };
const leads = catalog as Candidate[];
const websiteFixes = opportunities as Candidate[];
const missingSites = noSite as NoSite[];
const allRecords = [...leads,...missingSites];
const types = ['All niches', ...Array.from(new Set(allRecords.map(l=>l.niche))).sort()];
const areas = ['Greater Memphis area','North Mississippi', ...Array.from(new Set(allRecords.map(l=>`${l.city}, ${l.state}`))).sort()];

function mixedOrder<T extends {niche:string}>(rows:T[]) {
  const groups = new Map<string,T[]>();
  for (const row of rows) groups.set(row.niche,[...(groups.get(row.niche)||[]),row]);
  const ordered:T[]=[];
  while (groups.size) for (const [name,group] of groups) {
    const row=group.shift();if(row)ordered.push(row);
    if(!group.length)groups.delete(name);
  }
  return ordered;
}

export async function GET(request:NextRequest) {
  const p=request.nextUrl.searchParams;
  if(p.get('meta')==='true') return NextResponse.json({types,areas,catalogued:leads.length,websiteFixes:websiteFixes.length,noWebsiteListed:missingSites.length,release:'2026-09-23.1'},{headers:{'Cache-Control':'public, max-age=3600'}});
  const mode=p.get('mode')||'Website fixes';
  if(!['Website fixes','No website listed','All listings'].includes(mode))return NextResponse.json({error:'Choose a supported opportunity type.'},{status:400});
  const type=p.get('type')||'All niches';
  const area=p.get('area')||'Greater Memphis area';
  if(!types.includes(type)||!areas.includes(area))return NextResponse.json({error:'Choose a supported niche and location.'},{status:400});
  const rawLimit=Number(p.get('limit')||25),rawOffset=Number(p.get('offset')||0);
  const limit=Number.isFinite(rawLimit)?Math.min(50,Math.max(1,Math.floor(rawLimit))):25;
  const offset=Number.isFinite(rawOffset)?Math.min(10000,Math.max(0,Math.floor(rawOffset))):0;
  const pool=mode==='Website fixes'?websiteFixes:mode==='No website listed'?missingSites:leads;
  const filtered=pool.filter(l=>(type==='All niches'||l.niche===type)&&(area==='Greater Memphis area'||(area==='North Mississippi'?l.state==='MS':`${l.city}, ${l.state}`===area)));
  const ordered=type==='All niches'?mixedOrder(filtered):filtered;
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
  const notice=mode==='Website fixes'?'These are real businesses with at least two specific website audit signals. The listed phone is rechecked on the site during search. Audit signals are leads for a manual review, not proof that the owner needs or wants a redesign.':mode==='No website listed'?'No website appears in the September 2026 source record. These are research prospects only: phone reachability, social profile ownership, and current operations are unverified.':'These are all contact-checked businesses, including polished sites. Switch to Website fixes for a focused prospect list.';
  return NextResponse.json({leads:checked.filter(x=>x!==null),found:filtered.length,checked:page.length,excluded:checked.filter(x=>x===null).length,nextOffset:offset+limit<ordered.length?offset+limit:null,source:'Overture Maps places (September 2026) and public business pages',notice},{headers:{'Cache-Control':'no-store'}});
}
