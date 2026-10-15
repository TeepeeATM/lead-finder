import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
const areas: Record<string,[number,number]> = {
  "Memphis, TN":[35.1495,-90.0490],
  "Southaven, MS":[34.98898,-90.01259],
  "Olive Branch, MS":[34.96176,-89.82953],
  "Horn Lake, MS":[34.95537,-90.03481],
  "Tunica, MS":[34.68455,-90.38288],
  "North Mississippi":[34.95537,-90.03481]
};
const tags:Record<string,string>={
  "Barbershops":'["shop"="hairdresser"]',
  "Beauty salons":'["shop"="beauty"]',
  "Landscaping":'["craft"="gardener"]',
  "Remodeling":'["craft"~"carpenter|builder|painter|roofer"]'
};
type Element={type:string;id:number;tags?:Record<string,string>};
const clean=(x?:string)=>x?.trim()||"";
export async function GET(req:NextRequest){
  const type=req.nextUrl.searchParams.get("type")||"Barbershops";
  const area=req.nextUrl.searchParams.get("area")||"North Mississippi";
  const limit=Math.min(50,Math.max(1,Number(req.nextUrl.searchParams.get("limit")||10)||10));
  if(!areas[area]||!tags[type])return NextResponse.json({error:"Unsupported area or business type"},{status:400});
  const [lat,lon]=areas[area];
  const radius=area==="North Mississippi"?45000:18000;
  const query=`[out:json][timeout:20];(nwr(around:${radius},${lat},${lon})${tags[type]};);out tags 180;`;
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),24000);
    let res:Response;
    try {res=await fetch("https://overpass.kumi.systems/api/interpreter",{method:"POST",body:new URLSearchParams({data:query}),headers:{"Content-Type":"application/x-www-form-urlencoded"},signal:controller.signal,cache:"no-store"});}
    finally{clearTimeout(timeout);}
    if(!res.ok)throw new Error("Discovery provider temporarily unavailable");
    const data=await res.json() as {elements?:Element[]};
    const seen=new Set<string>();
    const leads=(data.elements||[]).flatMap(el=>{
      const t=el.tags||{};
      const name=clean(t.name);
      const website=clean(t.website||t["contact:website"]);
      const phone=clean(t.phone||t["contact:phone"]);
      const email=clean(t.email||t["contact:email"]);
      if(!name||!website||(!phone&&!email))return [];
      let url:URL;
      try{url=new URL(/^https?:\/\//i.test(website)?website:"https://"+website);if(!["http:","https:"].includes(url.protocol))return [];}catch{return [];}
      const key=(url.hostname.replace(/^www\./,"")+"|"+name.toLowerCase()).replace(/\s+/g,"");
      if(seen.has(key))return [];seen.add(key);
      const city=clean(t["addr:city"])||area;
      const contactCount=Number(!!phone)+Number(!!email);
      const score=50+contactCount*10+Number(!!t["addr:street"])*10+Number(!!t["opening_hours"])*5;
      return [{id:`${el.type}/${el.id}`,name,type,place:city,website:url.href,phone:phone||null,email:email||null,score,scoreLabel:"Record completeness",source:`https://www.openstreetmap.org/${el.type}/${el.id}`,why:"Public business record includes a website and contact details. Website quality has not been audited.",stage:"Researching",next:"Verify website"}];
    }).sort((a,b)=>b.score-a.score).slice(0,limit);
    return NextResponse.json({leads,found:leads.length,source:"OpenStreetMap contributors via Overpass API",notice:"Directory data can be outdated. Verify website and contact details before outreach. Scores measure record completeness, not buying intent."});
  }catch{
    return NextResponse.json({error:"Live discovery is temporarily unavailable. Please try again later; no sample leads were substituted."},{status:503});
  }
}
