// Offline only: read source text, exclude the entire entrypoint, inject fake SDK.
// Never import or execute the audit module, initialize Firebase, or fetch records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { calculateWeightUsage } from '../utils/calculateWeightUsage.js';
const url = new URL('../scripts/audit-record-weights.mjs', import.meta.url);
const source = readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
function prepareLibrary(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  assert.ok(normalized.includes('\nlet auditDb;'));
  const library = normalized.slice(0, normalized.indexOf('\nlet auditDb;'))
    .replace(/^import .*;\n/gm, '').replaceAll('import.meta.url', JSON.stringify(url.href));
  assert.doesNotMatch(library, /^\s*import\b/m, 'Import declarations must not reach vm evaluation');
  assert.doesNotMatch(library, /initializeApp\(|getFirestore\(/);
  return library;
}
function harness(overrides = {}, text = source) {
  const library = prepareLibrary(text);
  const messages = [];
  const ctx = {
    calculateWeightUsage, process: { argv: ['node', 'audit'], env: {} },
    console: { error: (...args) => messages.push(args.join(' ')) },
    parseEnv, fileURLToPath, dirname, join,
    readFile: async () => { throw Object.assign(new Error('absent'), { code: 'ENOENT' }); },
    ...overrides,
  };
  const api = vm.runInNewContext(`${library}\n({analyse,stats,weight,scalar,confirmReadOnly,loadFirebaseConfig,readRecords,assertOutsideGit,readLog})`, ctx);
  return { ...api, messages };
}
const normalize = value => JSON.parse(JSON.stringify(value));
for (const [label, text] of [['LF', source], ['CRLF', source.replace(/\n/g, '\r\n')]]) {
  test(`harness removes imports and excludes entrypoint with ${label} endings`, () => {
    const library = prepareLibrary(text);
    assert.doesNotMatch(library, /^\s*import\b/m);
    assert.equal(library.includes('let auditDb;'), false);
    assert.equal(harness({}, text).stats([10, 20]).mean, 15);
  });
}
test('harness rejects an unremoved import before vm evaluation', () => {
  assert.throws(() => harness({}, "import {\n  initializeApp\n} from 'firebase/app';\n" + source),
    /Import declarations must not reach vm evaluation/);
});
const r = (id, changes = {}) => ({ id: String(id), date: '2026-10-15T00:00:00Z', staffId: '0137', wardId: '6f', unit: 'weight',
  weightPrev: 200, weightNow: 190, isBottleExchange: false, ml: 11.47, ...changes });
test('entrypoint not executed; forbidden auth/writes/processes and personal-field access absent', () => {
  for (const word of ['applicationDefault','google-auth-library','firebase-admin','gcloud','child_process','addDoc','setDoc','updateDoc','deleteDoc','runTransaction','writeBatch','fixRecords','importStaff']) {
    assert.equal(source.includes(word), false, word);
  }
  assert.doesNotMatch(source, /\b(?:exec|spawn|execFile|execSync)\s*\(|\.name\b|\.data\s*\(|process\.env\s*\[[^\]]+\]\s*=/);
  const fieldLine = source.match(/const FIELDS = Object.freeze\((.*)\);/)[1];
  assert.equal(fieldLine.includes("'name'"), false);
  assert.equal((source.match(/collection\(db, 'records'\)/g) || []).length, 1);
  assert.doesNotMatch(source, /fetch\(|https?:\/\//);
});
test('percentiles nearest-rank, median and mean, empty distribution', () => {
  const h=harness();const s=h.stats([10,40,50,50,50,100]);
  assert.deepEqual(normalize(s),{count:6,min:10,median:50,mean:50,max:100,p95:100,p99:100});
  assert.equal(h.stats([]).median,null);
});
test('normal distributions/cutoffs/ward counts retain current calculation', () => {
  const records=[10,40,50,50,50,100].map((d,i)=>r(i,{weightPrev:200,weightNow:200-d,ml:calculateWeightUsage(200,200-d)}));
  const a=harness().analyse(records);
  assert.equal(a.normalPositiveDecreaseG.count,6);assert.equal(a.normalPositiveDecreaseG.median,50);
  assert.equal(a.normalPositiveDecreaseG.cutoffs.at_least_50g.count,4);
  assert.equal(a.normalPositiveDecreaseG.cutoffs.at_least_100g.count,1);
  assert.equal(a.wards['6f'].records,6);assert.equal(a.counts.mlComparison.exact,6);
  assert.match(a.methodology.percentile,/nearest-rank/);
});
test('exchange flag missing/null/string stay distinct from booleans', () => {
  const a=harness().analyse([r(1),r(2,{isBottleExchange:true}),r(3,{isBottleExchange:undefined}),r(4,{isBottleExchange:'false'}),r(5,{isBottleExchange:null})]);
  assert.deepEqual(normalize(a.counts.exchangeAllRecords),{false:1,true:1,missing:1,non_boolean:2});
});
for (const [value, expected] of [[undefined,'missing'],[null,'missing'],['','missing'],['20日','non_numeric'],[[], 'non_numeric'],[NaN,'non_finite'],[Infinity,'non_finite'],['Infinity','non_finite'],[264,'out_of_range'],[45,'out_of_range'],['45.5','valid']]) {
  test(`current weight classification ${String(value)} => ${expected}`,()=>assert.equal(harness().weight(value,false).status,expected));
}
test('zero ml separates equality, 1–3g increase, fractional increase and other; positive histogram excludes them', () => {
  const a=harness().analyse([r(1,{weightNow:200,ml:0}),r(2,{weightNow:202,ml:0}),r(3,{weightNow:200.5,ml:0}),r(4,{weightNow:190,ml:0})]);
  assert.deepEqual(normalize(a.counts.zeroMlAllRecords),{total:4,sameWeight:1,increase1To3g:1,other:2,otherIncludesUnder1g:1});
  assert.equal(a.normalPositiveDecreaseG.count,1);assert.equal(a.normalSavedMlIncludingZero.count,4);
});
test('exchange direction distributions preserve overlapping less-or-equal subtotal', () => {
  const a=harness().analyse([190,200,202,210].map((n,i)=>r(i,{weightNow:n,isBottleExchange:true,ml:calculateWeightUsage(200,n,true)})));
  assert.deepEqual(normalize(a.exchange.directions),{increaseOver3g:1,increaseUpTo3g:1,same:1,decrease:1});
  assert.equal(a.exchange.currentLessOrEqualPreviousSubtotal,2);assert.equal(a.counts.mlComparison.exact,4);
});
test('chain and short intervals are adjacent inclusive comparisons, no ID normalization', () => {
  const a=harness().analyse([
    r('a',{weightNow:190,date:'2026-10-15T00:00:00Z'}),
    r('b',{weightPrev:180,date:'2026-10-15T00:00:30Z'}),
    r('c',{weightPrev:190,date:'2026-10-15T00:01:30Z'}),
    r('d',{staffId:'０１３７',date:'2026-10-15T00:01:31Z'}),
  ]);
  assert.equal(a.counts.chain.mismatches,1);assert.equal(a.review.chainMismatches[0].differenceG,-10);
  assert.deepEqual(normalize(a.counts.shortIntervals),{adjacentPairsWithin30Seconds:1,adjacentPairsWithin60Seconds:2,adjacentPairsWithin300Seconds:2});
});
test('ml classification exact/tolerance/difference/missing/invalid/noncomparable', () => {
  const a=harness().analyse([r(1),r(2,{ml:11.48}),r(3,{ml:11.49}),r(4,{ml:undefined}),r(5,{ml:NaN}),r(6,{isBottleExchange:undefined})]);
  assert.deepEqual(normalize(a.counts.mlComparison),{within001:2,exact:1,nonzeroWithin001:1,over001:1,missing:1,invalid:1,notComparable:1});
});
test('fake paged SDK reads only records, stable cursor; forbidden field getter never touched',async()=>{
  let reads=0;const requested=[];
  const doc=id=>({id:String(id),get:field=>{assert.notEqual(field,'name');return {staffId:'0137',weightPrev:200,weightNow:190,unit:'weight'}[field];},data:()=>assert.fail('whole document access')});
  const h=harness({
    collection:(db,id)=>{assert.equal(id,'records');return id;},query:(col,...args)=>({col,args}),
    orderBy:field=>({orderBy:field}),documentId:()=> '__document_id__',limit:n=>{assert.equal(n,500);return {limit:n};},startAfter:id=>({cursor:id}),
    getDocsFromServer:async q=>{requested.push(q);reads++;return {docs:reads===1?Array.from({length:500},(_,i)=>doc(String(i).padStart(3,'0'))):[doc('500')]};},
  });
  const records=await h.readRecords({});assert.equal(records.length,501);assert.equal(reads,2);
  assert.equal(requested[1].args.at(-1).cursor,'499');
  assert.equal(Object.keys(records[0]).includes('name'),false);
  assert.equal(h.readLog.every(x=>x.operation==='getDocsFromServer'&&x.collection==='records'),true);
});
test('SDK server read failure is propagated, no cached fallback',async()=>{
  const h=harness({collection:()=> 'records',query:()=>({}),orderBy:()=>({}),documentId:()=>'',limit:()=>({}),getDocsFromServer:async()=>{throw Error('denied');}});
  await assert.rejects(h.readRecords({}),/denied/);
});
test('explicit confirmation required; no alternate project/collection/method flags accepted',()=>{
  for(const argv of [[],['--project=other'],['--confirm-records-read-only','--collection=other']])assert.throws(()=>harness({process:{argv:['node','audit',...argv],env:{}}}).confirmReadOnly());
  assert.doesNotThrow(()=>harness({process:{argv:['node','audit','--confirm-records-read-only'],env:{}}}).confirmReadOnly());
});
test('missing environment stops and logs only variable names',async()=>{
  const h=harness();await assert.rejects(h.loadFirebaseConfig());
  assert.match(h.messages.join(' '),/NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
});
test('environment loading does not mutate process environment or print configuration values',async()=>{
  const keys=['API_KEY','AUTH_DOMAIN','PROJECT_ID','STORAGE_BUCKET','MESSAGING_SENDER_ID','APP_ID'];
  const values=keys.map(k=>`NEXT_PUBLIC_FIREBASE_${k}=${k==='PROJECT_ID'?'audit-example':'dummy-hidden-value'}`).join('\n');
  const env={};const h=harness({process:{argv:[],env},readFile:async()=>values});
  const config=await h.loadFirebaseConfig();assert.equal(config.projectId,'audit-example');assert.equal(h.messages.length,0);assert.deepEqual(env,{});
});
test('output guard rejects Git directory/pointer before output creation',async()=>{
  const h=harness({stat:async()=>({})});await assert.rejects(h.assertOutsideGit('/tmp/example'),/Git work tree/);
});
test('Client Timestamp is converted for date ordering; arbitrary maps are not traversed',()=>{
  const h=harness();assert.equal(h.scalar({toDate:()=>new Date('2026-10-15T00:00:00Z')}).timestamp,'2026-10-15T00:00:00.000Z');
  assert.equal(h.scalar({unused:'ignored'}).invalidType,'map');assert.equal(h.scalar([]).invalidType,'array');
});
test('analysis never reads or serializes an unrelated personal-field getter',()=>{
  const record=r(1,{weightNow:100,ml:114.68});Object.defineProperty(record,'name',{enumerable:true,get:()=>assert.fail('personal field read')});
  const a=harness().analyse([record]);assert.equal(a.normalPositiveDecreaseG.max,100);
  assert.equal(JSON.stringify(a).includes('"name"'),false);
});
