import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchRecentNormalWeightHistory, NORMAL_WEIGHT_HISTORY_LIMITS } from '../utils/fetchRecentNormalWeightHistory.js';
import { evaluateWeightRemeasurement } from '../utils/weightRemeasurement.js';
const evaluatedAt = '2026-10-20T00:00:00Z';
const input = { db: {}, staffId: '0137', evaluatedAt };
function doc(id, changes={}) {
  const record={ date:new Date(Date.UTC(2026,9,19)-Number(id)*60000).toISOString(),unit:'weight',isBottleExchange:false,weightPrev:250,weightNow:228.2,ml:25,...changes };
  return {id:String(id),get(field){assert.notEqual(field,'name');assert.notEqual(field,'staffId');return record[field];},data(){throw new Error('No whole document access');}};
}
function adapter(docs) {
  const calls=[];
  return {calls,read:async args=>{calls.push(args);const offset=args.cursor?docs.findIndex(d=>d===args.cursor)+1:0;return docs.slice(offset,offset+args.pageSize);}};
}
async function run(docs) {const mock=adapter(docs);const result=await fetchRecentNormalWeightHistory(input,mock.read);return {result,mock};}
test('latest three, explicit projection, descending dates and Step 1 compatibility',async()=>{
 const {result,mock}=await run([doc(4),doc(1),doc(3),doc(2)]);
 assert.equal(result.status,'complete');assert.deepEqual(result.history.map(r=>r.documentId),['1','2','3']);assert.equal(mock.calls.length,1);
 assert.deepEqual(Object.keys(result.history[0]).sort(),['date','documentId','isBottleExchange','ml','unit','weightNow','weightPrev']);
 assert.equal(evaluateWeightRemeasurement({currentMl:50,isBottleExchange:false,history:result.history,evaluatedAt}).personalMedianMl,25);
});
for(const [label,changes] of [
 ['zero',{weightNow:250,ml:0}],['exchange',{isBottleExchange:true}],['ml mismatch',{ml:999}],
 ['weight missing',{weightNow:undefined}],['date invalid',{date:'bad'}],['flag missing',{isBottleExchange:undefined}],['unit missing',{unit:undefined}],
])test(`skip ${label} and retain older eligible records`,async()=>{
 const {result}=await run([doc(0,changes),doc(1),doc(2),doc(3)]);assert.equal(result.status,'complete');assert.deepEqual(result.history.map(r=>r.documentId),['1','2','3']);
});
test('pages past unsuitable latest documents, full page requires exhaustion lookahead',async()=>{
 const docs=Array.from({length:23},(_,i)=>doc(i,i<20?{ml:999}:{}));const {result,mock}=await run(docs);
 assert.equal(result.status,'complete');assert.equal(mock.calls.length,2);assert.equal(mock.calls[1].cursor,docs[19]);
 assert.equal(mock.calls[0].staffId,'0137');assert.equal(mock.calls[0].pageSize,20);
});
for(const n of [0,2])test(`exhausted ${n} is real insufficient`,async()=>{const {result}=await run(Array.from({length:n},(_,i)=>doc(i)));assert.equal(result.status,'insufficient');assert.equal(result.history.length,n);});
test('scan limit is NOT insufficient, even when three candidates already found',async()=>{
 const {result,mock}=await run(Array.from({length:101},(_,i)=>doc(i)));
 assert.equal(result.status,'limit_reached');assert.equal(result.history,null);assert.equal(result.documentsScanned,100);assert.equal(mock.calls.length,6);assert.equal(result.probeDocumentsRead,1);assert.equal(mock.calls[5].pageSize,1);
});
test('SDK failure preserved and no retry/cache fallback',async()=>{
 let calls=0;const error=new Error('permission denied');await assert.rejects(fetchRecentNormalWeightHistory(input,async()=>{calls++;throw error;}),e=>e===error);assert.equal(calls,1);
});
for(const staffId of ['', ' ', null, undefined, 137, [], {}, '０１３７',' 0137','a/b','.','..'])test(`reject invalid ID ${String(staffId)} before reading`,async()=>{
 await assert.rejects(fetchRecentNormalWeightHistory({...input,staffId},async()=>{throw new Error('Must not read');}),TypeError);
});
test('canonical test IDs and leading zeros unchanged',async()=>{
 for(const staffId of ['0137','test-4f']){let received;await fetchRecentNormalWeightHistory({...input,staffId},async args=>{received=args.staffId;return [];});assert.equal(received,staffId);}
});
test('tie group across page boundary excluded, including unsuitable twin',async()=>{
 const docs=Array.from({length:19},(_,i)=>doc(i,{ml:999}));const date='2026-10-18T00:00:00Z';
 docs.push(doc(19,{date}),doc(20,{date,ml:999}),doc(21),doc(22),doc(23));
 const {result,mock}=await run(docs);assert.equal(mock.calls.length,2);assert.deepEqual(result.history.map(r=>r.documentId),['21','22','23']);
});
test('all same timestamp excluded; future and current timestamp excluded',async()=>{
 const date='2026-10-18T00:00:00Z';const {result}=await run([doc(1,{date}),doc(2,{date}),doc(3,{date:evaluatedAt}),doc(4,{date:'2026-10-21T00:00:00Z'})]);assert.equal(result.status,'insufficient');assert.equal(result.history.length,0);
});
test('mixed date types/order do not cause an incorrect early-success baseline',async()=>{
 const old=Array.from({length:20},(_,i)=>doc(i,{date:new Date(Date.UTC(2026,8,1)-i*60000)}));
 const newer=[doc(21),doc(22),doc(23)];const {result}=await run([...old,...newer]);assert.deepEqual(result.history.map(r=>r.documentId),['21','22','23']);
});
test('static readonly SDK adapter and shared eligibility, no Firebase initialization',()=>{
 const source=readFileSync(new URL('../utils/fetchRecentNormalWeightHistory.js',import.meta.url),'utf8');
 for(const word of ['addDoc','setDoc','updateDoc','deleteDoc','writeBatch','runTransaction','initializeApp','firebaseConfig'])assert.equal(source.includes(word),false);
 assert.match(source,/getDocsFromServer\(query\(collection\(db, 'records'\)/);
 assert.match(source,/where\('staffId', '==', staffId\)/);assert.match(source,/orderBy\(documentId\(\)\)/);assert.doesNotMatch(source,/orderBy\(['"]date/);
 assert.match(source,/eligibleNormalUsage\(r.record\)/);assert.equal(source.includes('calculateWeightUsage'),false);
 assert.equal(NORMAL_WEIGHT_HISTORY_LIMITS.maxDocuments,100);
});

test('exactly 100 documents: empty one-document probe confirms complete',async()=>{
 const {result,mock}=await run(Array.from({length:100},(_,i)=>doc(i)));
 assert.equal(result.status,'complete');assert.equal(result.documentsScanned,100);
 assert.equal(result.probeDocumentsRead,0);assert.equal(result.pagesRead,6);
 assert.equal(mock.calls.at(-1).pageSize,1);assert.deepEqual(result.history.map(r=>r.documentId),['0','1','2']);
});
test('exactly 100 but no eligible records: exhausted insufficient',async()=>{
 const {result}=await run(Array.from({length:100},(_,i)=>doc(i,{ml:999})));
 assert.equal(result.status,'insufficient');assert.deepEqual(result.history,[]);assert.equal(result.probeDocumentsRead,0);
});
test('overflow probe never accesses fields or adds the 101st candidate',async()=>{
 const docs=Array.from({length:100},(_,i)=>doc(i));
 docs.push({id:'overflow',get(){throw new Error('probe fields must not be accessed');}});
 const {result}=await run(docs);assert.equal(result.status,'limit_reached');assert.equal(result.history,null);
});
test('probe error propagates, never returns success with partial candidates',async()=>{
 let calls=0;const error=new Error('probe failed');
 await assert.rejects(fetchRecentNormalWeightHistory(input,async()=>{
   if(++calls===6)throw error;return Array.from({length:20},(_,i)=>doc((calls-1)*20+i));
 }),e=>e===error);assert.equal(calls,6);
});
test('server adapter builds staff filter and documentId order, forwards snapshot cursor, uses server-only read',async()=>{
 const source=readFileSync(new URL('../utils/fetchRecentNormalWeightHistory.js',import.meta.url),'utf8');
 const body=source.slice(source.indexOf('async function serverPage('),source.indexOf('\nfunction time('))
   .replace("await import('firebase/firestore')",'sdk');
 const constraints=[];let reads=0;const page={docs:[]};
 const sdk={collection:(db,id)=>{assert.equal(id,'records');return {db,id};},query:(col,...args)=>{constraints.push(args);return col;},
   where:(...args)=>['where',...args],orderBy:(...args)=>['orderBy',...args],documentId:()=>'$documentId',
   limit:n=>['limit',n],startAfter:c=>['startAfter',c],getDocsFromServer:async()=>{reads++;return page;}};
 const fn=vm.runInNewContext(body+';serverPage',{sdk});const cursor={id:'cursor'};
 await fn({db:{},staffId:'0137',cursor,pageSize:20});await fn({db:{},staffId:'0137',cursor,pageSize:1});
 assert.deepEqual(JSON.parse(JSON.stringify(constraints[0])),[['where','staffId','==','0137'],['orderBy','$documentId'],['limit',20],['startAfter',cursor]]);
 assert.equal(constraints[1][2][1],1);assert.equal(reads,2);
});
test('missing and timezone-less date excluded; offsets/Timestamp normalize before chronological selection',async()=>{
 const docs=[doc(0,{date:undefined}),doc(1,{date:'2026-10-19T00:00:00'}),
 doc(2,{date:'2026-10-19T09:00:00+09:00'}),doc(3,{date:{toDate:()=>new Date('2026-10-18T23:59:00Z')}}),doc(4,{date:'2026-10-18T23:58:00Z'})];
 const {result}=await run(docs);assert.deepEqual(result.history.map(r=>r.documentId),['2','3','4']);
 assert.equal(result.history[0].date,'2026-10-19T00:00:00.000Z');
});
