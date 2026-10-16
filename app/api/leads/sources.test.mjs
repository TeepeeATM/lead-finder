import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishedContact, officialLeads } from './sources.ts';

test('requires visible identity and exact published phone',()=>{
  assert.equal(publishedContact('<h1>Oasis Grooming</h1><p>(662) 510-5888</p>','6625105888','Oasis'),true);
  assert.equal(publishedContact('Oasis 662-510-5889','6625105888','Oasis'),false);
  assert.equal(publishedContact('Other business 662-510-5888','6625105888','Oasis'),false);
  assert.equal(publishedContact('Oasis<script>6625105888</script>','6625105888','Oasis'),false);
});
test('provider fails closed, never substitutes records, respects coverage',async()=>{
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async()=>{throw new Error('outage');};
    const failed = await officialLeads('Barbershops','North Mississippi');
    assert.deepEqual(failed.leads,[]);
    assert.equal(failed.failed,failed.attempted);
    assert.equal((await officialLeads('Barbershops','Tunica, MS')).attempted,0);
    globalThis.fetch = async()=>new Response('<h1>Oasis Grooming</h1><p>662-510-5888</p>',{headers:{'content-type':'text/html'}});
    const good = await officialLeads('Barbershops','Southaven, MS');
    assert.equal(good.leads.length,1);
    assert.equal(good.leads[0].verification,'published-contact');
    assert.equal(good.leads[0].email,null);
    globalThis.fetch = async()=>new Response('Oasis 662-510-5889',{headers:{'content-type':'text/html'}});
    assert.equal((await officialLeads('Barbershops','Southaven, MS')).leads.length,0);
  } finally {globalThis.fetch=original;}
});
