type Candidate = {name:string;phone:string;contactSource:string};
const phonePattern=/(?<!\d)(?:\+?1[\s().-]*)?\(?[2-9]\d{2}\)?[\s().-]*[2-9]\d{2}[\s().-]*\d{4}(?!\d)/g;
const skip=new Set(['the','and','llc','inc','ltd','company','co','corp','of','at','a']);

function identityMatches(name:string,text:string){
  const words=(name.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>!skip.has(w));
  if(!words.length)return false;
  const normalized=(text.toLowerCase().match(/[a-z0-9]+/g)||[]).join(' ');
  if(normalized.includes(words.join(' ')))return true;
  if(words.length===1)return words[0].length>=5&&normalized.split(' ').includes(words[0]);
  const salient=words.filter(w=>w.length>=4).sort((a,b)=>b.length-a.length).slice(0,2);
  return salient.length===2&&salient.every(w=>normalized.split(' ').includes(w));
}

export function publishedContact(html:string,name:string,phone:string){
  const text=html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ');
  const found=Array.from(text.matchAll(phonePattern)).some(m=>m[0].replace(/\D/g,'').slice(-10)===phone);
  return found&&identityMatches(name,text);
}

export async function checkPublishedContact(candidate:Candidate){
  try {
    const url=new URL(candidate.contactSource);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return false;
    const response=await fetch(url,{signal:AbortSignal.timeout(7000),cache:'no-store',redirect:'error',headers:{Accept:'text/html'}});
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))return false;
    if(Number(response.headers.get('content-length')||0)>2_000_000)return false;
    return publishedContact((await response.text()).slice(0,2_000_000),candidate.name,candidate.phone);
  } catch{return false;}
}
