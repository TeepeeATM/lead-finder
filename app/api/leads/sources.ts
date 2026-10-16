// Researched official sources, not generated examples. Coverage is deliberately limited.
// Service-area entries explicitly distinguish service coverage from a physical location.
export const sources = [
  {name:"Oasis Grooming",type:"Barbershops",place:"Southaven, MS",areas:["Southaven, MS"],url:"https://oasis-grooming.com/",phone:"6625105888",identity:"Oasis"},
  {name:"ManCave Salon LLC",type:"Barbershops",place:"Olive Branch, MS",areas:["Olive Branch, MS"],url:"https://www.mancavesalonllc.com/",phone:"6628938908",identity:"MANCAVE"},
  {name:"Presidential Barber Lounge",type:"Barbershops",place:"Memphis, TN",areas:["Memphis, TN"],url:"https://www.pblmemphis.com/",phone:"9013472366",identity:"Presidential"},
  {name:"Salon Haven",type:"Beauty salons",place:"Southaven, MS",areas:["Southaven, MS"],url:"https://salonhavenms.com/",phone:"6629328503",identity:"Haven"},
  {name:"Green Earth",type:"Landscaping",place:"Germantown, TN · serves North Mississippi",areas:["Memphis, TN","North Mississippi"],url:"https://www.green-earthllc.com/about-us/",phone:"9016573614",identity:"Green Earth"},
  {name:"Ryan's Lawn Service",type:"Landscaping",place:"Memphis, TN · serves North Mississippi",areas:["Memphis, TN","North Mississippi"],url:"https://www.ryanslawnservicetn.com/",phone:"9018702475",identity:"Ryan"},
  {name:"A Final Touch",type:"Remodeling",place:"Serves Memphis, Southaven and Olive Branch",areas:["Memphis, TN","Southaven, MS","Olive Branch, MS","North Mississippi"],url:"https://www.getyourfinaltouch.com/",phone:"9012651661",identity:"Final Touch"},
  {name:"Johnson Brothers Construction LLC",type:"Remodeling",place:"Southaven, MS",areas:["Southaven, MS"],url:"https://www.johnsonbrothersconstructionllc.com/",phone:"9018572418",identity:"Johnson"}
];

export function publishedContact(html: string, phone: string, identity: string) {
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ");
  // Match a complete NANP phone in visible text; arbitrary concatenated digits don't qualify.
  const phones = text.match(/(?:\+?1[\s.-]*)?\(?[2-9]\d{2}\)?[\s.-]*[2-9]\d{2}[\s.-]*\d{4}\b/g) || [];
  return text.toLowerCase().includes(identity.toLowerCase()) && phones.some(p=>p.replace(/\D/g,"").slice(-10)===phone);
}

export async function officialLeads(type: string, area: string) {
  const candidates = sources.filter(s=>s.type===type && (s.areas.includes(area) || (area==="North Mississippi" && s.areas.some(a=>a.endsWith(", MS")))));
  let failed = 0;
  const checked = await Promise.all(candidates.map(async s=>{
    try {
      const response = await fetch(s.url,{signal:AbortSignal.timeout(6500),cache:"no-store",redirect:"error",headers:{Accept:"text/html"}});
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("Source unavailable");
      const html = await response.text();
      if (!publishedContact(html,s.phone,s.identity)) throw new Error("Contact no longer confirmed");
      return {id:"official:"+new URL(s.url).hostname,name:s.name,type,place:s.place,website:s.url,phone:"+1"+s.phone,email:null,score:60,source:s.url,verification:"published-contact",checkedAt:new Date().toISOString(),why:"Official website responded and displays this phone number. Phone ownership, deliverability, business activity and SMS capability have not been independently verified.",stage:"Researching",next:"Verify business"};
    } catch {failed++;return null;}
  }));
  return {leads:checked.filter(x=>x!==null),attempted:candidates.length,failed};
}
