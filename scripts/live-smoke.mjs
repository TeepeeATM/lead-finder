// Run explicitly after next build. Exercises the built API with real provider requests.
import {spawn} from 'node:child_process';
const port=4037;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{stdio:['ignore','pipe','pipe']});
let started=false;let log='';
server.stdout.on('data',d=>{log+=d;if(log.includes('Ready in'))started=true;});
server.stderr.on('data',d=>{log+=d;});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try {
 for(let i=0;i<100&&!started;i++)await delay(100);
 if(!started)throw new Error('Smoke server did not start: '+log.slice(-500));
 const meta=await fetch(`http://127.0.0.1:${port}/api/leads?meta=true`).then(r=>r.json());
 if(meta.mode!=='no-website-found'||meta.types.length!==4)throw new Error('Unexpected API metadata');
 let succeeded=0,totalQualified=0;
 for(const type of meta.types){
  const r=await fetch(`http://127.0.0.1:${port}/api/leads?`+new URLSearchParams({type,area:'Memphis, TN',limit:'5'}),{signal:AbortSignal.timeout(58000)});
  const d=await r.json();
  if(r.ok)succeeded++;
  totalQualified+=(d.leads||[]).length;
  if((d.leads||[]).some(l=>l.website||l.verification!=='no-website-found'||!l.evidence?.length))throw new Error('Unqualified lead leaked into results');
  console.log('LIVE_SMOKE '+JSON.stringify({type,status:r.status,candidates:d.found??null,checked:d.checked??0,qualified:d.leads?.length??0,verificationFailures:d.verificationFailures??0,error:d.error??null}));
 }
 console.log('LIVE_SMOKE_SUMMARY '+JSON.stringify({successfulQueries:succeeded,qualifiedLeads:totalQualified}));
 if(succeeded!==4)throw new Error('Live map discovery did not succeed for every industry. Do not promote this build.');
} finally {server.kill('SIGTERM');}
