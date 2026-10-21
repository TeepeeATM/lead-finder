import { NextRequest, NextResponse } from 'next/server';
import catalog from '../../data/leads.json';
import { checkPublishedContact } from './validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Candidate = { id:string; name:string; niche:string; city:string; state:string; website:string; phone:string; contactSource:string; catalogCheckedAt:string; confidence:number; release:string };
const leads = catalog as Candidate[];
const types = ['All niches', ...Array.from(new Set(leads.map(l=>l.niche))).sort()];
const areas = ['Greater Memphis area','North Mississippi', ...Array.from(new Set(leads.map(l=>`${l.city}, ${l.state}`))).sort()];

function mixedOrder(rows:Candidate[]) {
  const groups = new Map<string,Candidate[]>();
  for (const row of rows) groups.set(row.niche,[...(groups.get(row.niche)||[]),row]);
  const ordered:Candidate[]=[];
  while (groups.size) for (const [name,group] of groups) {
    const row=group.shift();if(row)ordered.push(row);
    if(!group.length)groups.delete(name);
  }
  return ordered;
}

export async function GET(request:NextRequest) {
  const p=request.nextUrl.searchParams;
  if(p.get('meta')==='true') return NextResponse.json({types,areas,catalogued:leads.length,release:'2026-09-23.1'},{headers:{'Cache-Control':'public, max-age=3600'}});
  const type=p.get('type')||'All niches';
  const area=p.get('area')||'Greater Memphis area';
  if(!types.includes(type)||!areas.includes(area))return NextResponse.json({error:'Choose a supported niche and location.'},{status:400});
  const rawLimit=Number(p.get('limit')||25),rawOffset=Number(p.get('offset')||0);
  const limit=Number.isFinite(rawLimit)?Math.min(50,Math.max(1,Math.floor(rawLimit))):25;
  const offset=Number.isFinite(rawOffset)?Math.min(10000,Math.max(0,Math.floor(rawOffset))):0;
  const filtered=leads.filter(l=>(type==='All niches'||l.niche===type)&&(area==='Greater Memphis area'||(area==='North Mississippi'?l.state==='MS':`${l.city}, ${l.state}`===area)));
  const ordered=type==='All niches'?mixedOrder(filtered):filtered;
  const page=ordered.slice(offset,offset+limit);
  const checked=await Promise.all(page.map(async candidate=>{
    if(!await checkPublishedContact(candidate))return null;
    return {id:candidate.id,name:candidate.name,type:candidate.niche,place:`${candidate.city}, ${candidate.state}`,website:candidate.website,phone:'+1'+candidate.phone,email:null,score:Math.round(candidate.confidence*100),source:candidate.contactSource,verification:'published-contact',checkedAt:new Date().toISOString(),why:'The business website responded and displayed its listed phone today. The place data lists it as open. Phone deliverability, revenue, and current operating status have not been independently confirmed.',stage:'Researching',next:'Verify business'};
  }));
  return NextResponse.json({leads:checked.filter(x=>x!==null),found:filtered.length,checked:page.length,excluded:checked.filter(x=>x===null).length,nextOffset:offset+limit<ordered.length?offset+limit:null,source:'Overture Maps places (September 2026) and business websites',notice:'Results come from high-confidence place records checked against their business websites. Each displayed phone was found on its source page during this search. A listed-open status and reachable site do not prove that the phone connects or that the business is thriving.'},{headers:{'Cache-Control':'no-store'}});
}
