import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publishedContact,checkPublishedContact} from './validation.ts';

test('only displays an exact phone published alongside the business identity',()=>{
  assert.equal(publishedContact('<h1>Oasis Grooming</h1><p>(662) 510-5888</p>','Oasis Grooming','6625105888'),true);
  assert.equal(publishedContact('<h1>Oasis Grooming</h1><p>(662) 510-5889</p>','Oasis Grooming','6625105888'),false);
  assert.equal(publishedContact('<h1>Other Shop</h1><p>(662) 510-5888</p>','Oasis Grooming','6625105888'),false);
  assert.equal(publishedContact('<h1>Oasis Grooming</h1><script>(662) 510-5888</script>','Oasis Grooming','6625105888'),false);
});

test('fails closed when the official contact page is missing or changed',async()=>{
  const original=globalThis.fetch;
  const lead={name:'Oasis Grooming',phone:'6625105888',contactSource:'https://example.com/contact'};
  try {
    globalThis.fetch=async()=>new Response('<h1>Oasis Grooming</h1><p>662-510-5888</p>',{headers:{'content-type':'text/html'}});
    assert.equal(await checkPublishedContact(lead),true);
    globalThis.fetch=async()=>new Response('<h1>Oasis Grooming</h1><p>662-510-5889</p>',{headers:{'content-type':'text/html'}});
    assert.equal(await checkPublishedContact(lead),false);
    globalThis.fetch=async()=>{throw new Error('outage')};
    assert.equal(await checkPublishedContact(lead),false);
  } finally {globalThis.fetch=original}
});
