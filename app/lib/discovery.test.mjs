import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toCandidate,classifyEvidence,makeQuery,parseRss,normalizePhone} from './discovery.ts';
const base={type:'node',id:42,lat:35,lon:-90,tags:{name:'Example Barber',shop:'hairdresser',phone:'901-555-0123'}};
const c=toCandidate(base,'Barbershops','Memphis, TN');
const item={title:'Example Barber in Memphis',url:'https://www.yelp.com/biz/example-barber',description:'Example Barber phone (901) 555-0123'};
test('a missing website alone never qualifies a business',()=>{
 assert.ok(c);assert.equal(classifyEvidence(c,[[],[]]).status,'inconclusive');
 assert.equal(classifyEvidence(c,[[{...item,description:'No contact information'}],[item]]).status,'no-website-found');
 assert.equal(classifyEvidence(c,[[{...item,description:'Different phone 901-555-0199'}],[{...item,description:'No contact information'}]]).status,'inconclusive');
});
test('existing websites excluded at both map and web-check stages',()=>{
 for(const key of ['website','contact:website','url','contact:url'])assert.equal(toCandidate({...base,tags:{...base.tags,[key]:'examplebarber.com'}},'Barbershops','Memphis'),null);
 assert.equal(classifyEvidence(c,[[item],[{...item,url:'https://examplebarber.com'}]]).status,'website-found');
 assert.equal(classifyEvidence(c,[[item],[{...item,url:'https://example.square.site'}]]).status,'website-found');
 assert.equal(classifyEvidence(c,[[item],[{...item,url:'https://yelp.com.attacker.example'}]]).status,'website-found');
});
test('social pages allowed; unreachable and ambiguous verification withheld',()=>{
 assert.ok(toCandidate({...base,tags:{...base.tags,website:'https://facebook.com/examplebarber'}},'Barbershops','Memphis'));
 assert.equal(classifyEvidence(c,[[item]]).status,'inconclusive');
 assert.equal(classifyEvidence(c,[[item],[{title:'Different business',url:'https://unknown.example',description:'unrelated'}]]).status,'inconclusive');
 assert.throws(()=>parseRss('<html>captcha</html>'));
});
test('contact and query validation',()=>{
 assert.equal(normalizePhone('+1 (901) 555-0123'),'+19015550123');assert.equal(normalizePhone('123'),null);
 assert.equal(toCandidate({...base,tags:{name:'Example Barber'}},'Barbershops','Memphis'),null);
 assert.equal(toCandidate({...base,tags:{...base.tags,disused:'yes'}},'Barbershops','Memphis'),null);
 assert.ok(makeQuery('Landscapers',35,-90,10000).includes('[craft=landscaper]'));
 assert.ok(makeQuery('Remodelers',35,-90,10000).includes('[craft=builder]'));
 const xml='<rss><channel><item><title>Example &amp; Sons</title><link>https://yelp.com/example</link><description><![CDATA[Phone 901-555-0123]]></description></item></channel></rss>';
 assert.equal(parseRss(xml)[0].title,'Example & Sons');assert.equal(parseRss(xml).length,1);
});
