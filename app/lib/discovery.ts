export const industries = ['Barbershops','Salons','Landscapers','Remodelers'] as const;
export const locations: Record<string,[number,number]> = {
  'Memphis, TN':[35.1495,-90.049], 'Cordova, TN':[35.155,-89.776], 'Germantown, TN':[35.0868,-89.8101],
  'Bartlett, TN':[35.2045,-89.8739], 'Collierville, TN':[35.042,-89.6645], 'Southaven, MS':[34.989,-90.0126],
  'Olive Branch, MS':[34.9618,-89.8295], 'Hernando, MS':[34.8239,-89.9937], 'Tunica, MS':[34.6845,-90.3829],
  'Clarksdale, MS':[34.2001,-90.5709], 'Oxford, MS':[34.3665,-89.5192], 'Tupelo, MS':[34.2576,-88.7034]
};
export type Element = {type:string;id:number;tags?:Record<string,string>;lat?:number;lon?:number;center?:{lat:number;lon:number}};
export type Candidate = {id:string;name:string;type:string;place:string;phone:string|null;email:string|null;source:string;website:string|null;socials:string[];lat:number;lon:number};
export type Evidence = {title:string;url:string;description:string};
const socialHosts = ['facebook.com','instagram.com','tiktok.com','youtube.com','x.com','twitter.com'];
const directoryHosts = [...socialHosts,'yelp.com','yellowpages.com','mapquest.com','bbb.org','chamberofcommerce.com','manta.com','superpages.com','foursquare.com','nextdoor.com','booksy.com','fresha.com','vagaro.com','styleseat.com','google.com','maps.apple.com','openstreetmap.org'];
function belongs(host:string,domains:string[]){return domains.some(d=>host===d||host.endsWith('.'+d));}
export function safeUrl(value:string){try{const u=new URL(/^https?:\/\//i.test(value)?value:'https://'+value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes('.')?u.href:null;}catch{return null;}}
export function normalizePhone(value:string){const digits=value.replace(/\D/g,'');const local=digits.length===11&&digits[0]==='1'?digits.slice(1):digits;return /^[2-9]\d{2}[2-9]\d{6}$/.test(local)?'+1'+local:null;}
export function toCandidate(element:Element,industry:string,area:string):Candidate|null {
 const t=element.tags||{};if(!t.name||t.disused==='yes'||t.abandoned==='yes'||t.closed==='yes'||t['opening_hours']==='closed')return null;
 if(industry==='Remodelers'&&!/remodel|renovat|home improvement/i.test(t.name+' '+(t.description||'')+' '+(t.speciality||'')+' '+(t.craft||'')))return null;
 if(industry==='Barbershops'&&t['hairdresser']!=='barber'&&t['male']!=='yes'&&!/barber/i.test(t.name))return null;
 const lat=element.lat??element.center?.lat,lon=element.lon??element.center?.lon;if(lat===undefined||lon===undefined)return null;
 const websites=['website','contact:website','url','contact:url'].map(k=>t[k]).filter(Boolean).flatMap(v=>v.split(';')).filter(v=>!['no','none','unknown'].includes(v.trim().toLowerCase()));
 const urls=websites.map(safeUrl);if(urls.some(u=>!u))return null;
 const standalone=urls.find(u=>u&&!belongs(new URL(u).hostname,socialHosts));
 if(standalone)return null;
 const phone=normalizePhone(t['contact:phone']||t.phone||'');const mail=(t['contact:email']||t.email||'').trim();
 const email=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(mail)?mail:null;
 if(!phone&&!email)return null;
 const socials=[...urls.filter((u):u is string=>!!u),...['contact:facebook','contact:instagram'].map(k=>t[k]).filter(Boolean).map(safeUrl).filter((u):u is string=>!!u)];
 return {id:`osm-${element.type}-${element.id}`,name:t.name,type:industry,place:[t['addr:housenumber'],t['addr:street'],t['addr:city']||area].filter(Boolean).join(' '),phone,email,source:`https://www.openstreetmap.org/${element.type}/${element.id}`,website:null,socials:[...new Set(socials)],lat,lon};
}
export function makeQuery(industry:string,lat:number,lon:number,radius:number){
 const tags=industry==='Barbershops'||industry==='Salons'?['[shop=hairdresser]','[shop=beauty]']:industry==='Landscapers'?['[craft=landscaper]','[office=landscaping]','[craft=gardener]']:['[craft=builder]','[craft=carpenter]','[craft=construction]','[craft=renovator]','[craft=remodeler]','[office=construction_company]'];
 return `[out:json][timeout:12];(${tags.map(t=>`nwr(around:${radius},${lat},${lon})${t}[name];`).join('')});out center tags;`;
}
function decode(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,v)=>String.fromCodePoint(v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&amp;/g,'&');}
export function parseRss(xml:string):Evidence[]{
 if(!/<rss\b/i.test(xml)||!/<\/channel>\s*<\/rss>/i.test(xml))throw new Error('Search verification returned an unsupported response.');
 return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>{
  const read=(k:string)=>decode(m[1].match(new RegExp(`<${k}[^>]*>([\\s\\S]*?)<\\/${k}>`,'i'))?.[1]||'');
  return {title:read('title'),url:read('link'),description:read('description').replace(/<[^>]*>/g,' ')};
 });
}
function tokens(s:string){return (s.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>!['the','llc','inc','and','of','co'].includes(w));}
export function classifyEvidence(candidate:Candidate,groups:Evidence[][]):{status:'no-website-found'|'website-found'|'inconclusive';evidence:Evidence[]}{
 if(groups.length<2||groups.some(g=>!g.length))return {status:'inconclusive',evidence:[]};
 const words=tokens(candidate.name);if(!words.length)return {status:'inconclusive',evidence:[]};
 const all=groups.flat();const related=all.filter(e=>{const text=tokens(e.title+' '+e.description).join(' ');return words.every(w=>text.split(' ').includes(w));});
 // Any unknown or standalone destination in either search is unresolved: do not certify absence.
 for(const e of related){const u=safeUrl(e.url);if(!u)return {status:'inconclusive',evidence:related};if(!belongs(new URL(u).hostname,directoryHosts))return {status:'website-found',evidence:related};}
 if(all.some(e=>{const u=safeUrl(e.url);return !u||!belongs(new URL(u).hostname,directoryHosts)}))return {status:'inconclusive',evidence:related};
 // Require corroboration of the exact business identity AND a published phone, not an empty OSM website field.
 const corroborated=related.filter(e=>candidate.phone&&(e.title+' '+e.description).replace(/\D/g,'').includes(candidate.phone.slice(2)));
 if(!corroborated.length)return {status:'inconclusive',evidence:related};
 return {status:'no-website-found',evidence:[...new Map(related.map(e=>[e.url,e])).values()]};
}
