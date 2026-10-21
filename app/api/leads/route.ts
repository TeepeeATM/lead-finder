import {NextRequest,NextResponse} from 'next/server';
import {industries,locations,makeQuery,toCandidate,parseRss,classifyEvidence,type Element,type Candidate,type Evidence} from '../../lib/discovery';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const headers={'Cache-Control':'no-store'};
const agent='CairvantLeadFinder/1.0 (+https://lead-finder-iota-drab.vercel.app)';
const endpoints=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter'];
const cache=new Map<string,{expires:number;elements:Element[]}>();
const running=new Map<string,Promise<Element[]>>();
async function discover(industry:string,area:string,radius:number){
 const key=JSON.stringify([industry,area,radius]);const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.elements;
 const pending=running.get(key);if(pending)return pending;
 const task=(async()=>{const [lat,lon]=locations[area];const query=makeQuery(industry,lat,lon,radius);
  for(const endpoint of endpoints){try{const r=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),headers:{'User-Agent':agent},signal:AbortSignal.timeout(16000),cache:'no-store'});
   if(!r.ok)continue;const data=await r.json();if(data.remark||!Array.isArray(data.elements))continue;
   if(cache.size>100)cache.clear();cache.set(key,{expires:Date.now()+900000,elements:data.elements});return data.elements as Element[];
  }catch{}}
  throw new Error('Both OpenStreetMap search providers are unavailable. No sample businesses were substituted. Try again shortly.');
 })();running.set(key,task);try{return await task;}finally{running.delete(key);}
}
async function verify(candidate:Candidate,area:string){
 const queries=[`"${candidate.name}" "${area.split(',')[0]}" website`,`"${candidate.name}" "${candidate.phone||candidate.email}"`];
 const groups:Evidence[][]=[];
 for(const query of queries){const url='https://www.bing.com/search?'+new URLSearchParams({q:query,format:'rss'});const r=await fetch(url,{signal:AbortSignal.timeout(6500),cache:'no-store',headers:{Accept:'application/rss+xml','User-Agent':agent}});if(!r.ok)throw new Error('Website verification unavailable');const xml=await r.text();if(xml.length>1000000)throw new Error('Oversized verification response');groups.push(parseRss(xml));}
 return classifyEvidence(candidate,groups);
}
export async function GET(request:NextRequest){
 const p=request.nextUrl.searchParams;
 if(p.get('meta')==='true')return NextResponse.json({types:industries,areas:Object.keys(locations),mode:'no-website-found'},{headers});
 const type=p.get('type')||'Barbershops',area=p.get('area')||'Memphis, TN';
 if(!industries.includes(type as typeof industries[number])||!Object.hasOwn(locations,area))return NextResponse.json({error:'Choose a supported industry and location.'},{status:400,headers});
 const offset=Number(p.get('offset')||0),limit=Number(p.get('limit')||5),radius=Number(p.get('radius')||10000);
 if(!Number.isInteger(offset)||offset<0||offset>10000||!Number.isInteger(limit)||limit<1||limit>5||![5000,10000,20000].includes(radius))return NextResponse.json({error:'Invalid search options.'},{status:400,headers});
 try{
  const elements=await discover(type,area,radius);
  const candidates=elements.map(e=>toCandidate(e,type,area)).filter((c):c is Candidate=>!!c);
  const unique=[...new Map(candidates.map(c=>[c.name.toLowerCase()+'|'+(c.phone||c.email),c])).values()].sort((a,b)=>a.id.localeCompare(b.id));
  const page=unique.slice(offset,offset+limit);let failures=0;
  const checked=await Promise.all(page.map(async c=>{try{const v=await verify(c,area);if(v.status!=='no-website-found')return null;return {...c,evidence:v.evidence,verification:v.status,checkedAt:new Date().toISOString(),stage:'Researching',why:'No standalone website was found in the OSM record or two web searches. Search results corroborated the business name and listed phone. This is evidence of no website found, not a guarantee that none exists. Phone deliverability and SMS/iMessage are unverified.'};}catch{failures++;return null;}}));
  return NextResponse.json({leads:checked.filter(Boolean),found:unique.length,checked:page.length,excluded:page.length-checked.filter(Boolean).length,verificationFailures:failures,nextOffset:offset+limit<unique.length?offset+limit:null,source:'OpenStreetMap contributors; Bing search results',notice:`${page.length} candidates checked; ${page.length-checked.filter(Boolean).length} withheld because a website was found or evidence was inconclusive.${failures?' Website verification was unavailable for '+failures+' candidates.':''} Missing website fields alone never qualify a lead. Public map coverage varies, especially for landscapers and remodelers.`},{headers});
 }catch(e){return NextResponse.json({leads:[],error:e instanceof Error?e.message:'Discovery unavailable'},{status:503,headers});}
}
