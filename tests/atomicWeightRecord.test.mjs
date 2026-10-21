import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';
import { isActiveStaff } from '../utils/isActiveStaff.js';
import { issueWeightChallenge, verifyWeightChallenge } from '../utils/server/weightRemeasurementChallenge.js';
import { evaluateWeightRemeasurementFlow, checkWeightFlowChallenge, WEIGHT_REMEASUREMENT_RULE_VERSION } from '../utils/server/weightRemeasurementFlow.js';
import { idleRemeasurement, acceptRemeasurementResponse, retryRemeasurement, recordFlowRequest, createRecordRequestScope } from '../utils/recordRemeasurementState.js';
import { precheckWeightRemeasurement, WeightPrecheckReadError } from '../utils/precheckWeightRemeasurement.js';
import { calculateWeightUsage } from '../utils/calculateWeightUsage.js';
import { prepareRecordOperation, createRecordOperationReceipt, resolveRecordOperationReceipt } from '../utils/server/recordOperationReceipt.js';
import { createRecordOperationLifecycle, savePendingRecordOperation, clearPendingRecordOperation, isKnownRecordFailure, isValidRecordSuccess, RECORD_RESULT_UNKNOWN_MESSAGE } from '../utils/recordOperationClient.js';

// Normalize CRLF only; preserve indentation, spaces, comments and executable code.
const normalizeLineEndings = source => source.replace(/\r\n/g, '\n');
const read = path => normalizeLineEndings(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const apiSource = read('pages/api/records.js').replace(/import[\s\S]*?from\s+["'][^"']+["'];\s*/g, '').replace('export default ', '');
const page = read('pages/record/index.js');
const valid = { staffId: '0137', name: 'Staff', wardId: '6f', department: '6階', weightPrev: 200, weightNow: 190, isBottleExchange: false, ml: 999, mintPoint: 1 };

// Atomic staged writes, with version-based retries to model Firestore transactions.
function database(initial = { 'staff/0137': { lastWeight: 200, isActive: true } }, failure = false, retireBeforeCommit = false, retryBeforeCommit = null) {
  const docs = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  let version = 0, serial = 0, reads = 0, transactionCalls = 0, transactionAttempts = 0;
  const commits = [];
  return { docs, commits, get reads() { return reads; }, get transactionCalls() {return transactionCalls;}, get transactionAttempts() {return transactionAttempts;},
    doc(...args) {
      const key = args.length === 1 ? `${args[0]}/new-${++serial}` : `${args[1]}/${args[2]}`;
      return { key, id: key.split('/').at(-1) };
    },
    async runTransaction(_, callback) {
      transactionCalls++;
      for (;;) {
        transactionAttempts++;
        const before = version;
        const snapshot = new Map([...docs].map(([k, v]) => [k, structuredClone(v)]));
        const pending = [];
        let writing = false;
        const result = await callback({
          async get(ref) {
            assert.equal(writing, false, 'all reads must precede writes');
            reads++;
            return { exists: () => snapshot.has(ref.key), data: () => snapshot.get(ref.key) };
          },
          set(ref, data) { writing = true; pending.push(['set', ref.key, data]); },
          update(ref, data) { writing = true; pending.push(['update', ref.key, data]); },
        });
        if (retireBeforeCommit && pending.length) {
          docs.set('staff/0137', { ...docs.get('staff/0137'), isActive: false });
          version++;
          retireBeforeCommit = false;
        }
        if (retryBeforeCommit && pending.length) {
          retryBeforeCommit(docs); version++; retryBeforeCommit = null;
        }
        if (before !== version) continue;
        if (failure && pending.length) throw new Error('commit failed');
        const next = new Map(docs);
        for (const [op, key, data] of pending) {
          if (op === 'update' && !next.has(key)) throw new Error('missing update document');
          next.set(key, structuredClone(op === 'update' ? { ...next.get(key), ...data } : data));
        }
        if (pending.length) {
          docs.clear(); for (const [k, v] of next) docs.set(k, v);
          version++; commits.push(pending);
        }
        return result;
      }
    },
  };
}
async function post(body = valid, db = database(), options = {}) {
  let staffReads = 0, historyReads = 0; const logs = [];
  const res = { status(code) { this.code = code; return this; }, json(data) { this.body = JSON.parse(JSON.stringify(data)); return this; } };
  await vm.runInNewContext(`${apiSource}\nhandler(req, res)`, {
    Date, db: {}, doc: db.doc, runTransaction: db.runTransaction,
    collection: (_, name) => name, Timestamp: { now: () => 'server-time' },
    normalizeStaffId, isActiveStaff, calculateWeightUsage, WeightPrecheckReadError,
    prepareRecordOperation, createRecordOperationReceipt, resolveRecordOperationReceipt,
    checkWeightFlowChallenge: (args, context) => checkWeightFlowChallenge(args, { ...context, secret: options.secret === undefined ? 'fixture-integration-secret-at-least-32-bytes' : options.secret, nowMs: options.now ? options.now() : Date.now() }),
    evaluateWeightRemeasurementFlow: (args, context) => evaluateWeightRemeasurementFlow(args, {
      ...context, secret: options.secret === undefined ? 'fixture-integration-secret-at-least-32-bytes' : options.secret,
      now: options.now ?? Date.now,
      precheck: async input => {
        if(options.beforePrecheck) await options.beforePrecheck(db);
        return precheckWeightRemeasurement(input, {
      readStaff: async ({staffId}) => { staffReads++; if(options.staffError) throw options.staffError; return structuredClone(db.docs.get(`staff/${staffId}`) ?? null); },
      readHistory: async () => { historyReads++; if(options.historyError) throw options.historyError;
        return options.historyResult ?? {status:'insufficient',history:[]}; },
        });
      },
    }).then(result => { if(options.afterPrecheck) options.afterPrecheck(db); return result; }),
    getAppBuildId: () => options.buildId === undefined ? "test-build" : options.buildId,
    req: { method: options.method ?? 'POST', body, headers: options.headers ?? { 'x-app-build-id': 'test-build' } }, res, console: { error(...args) {logs.push(args);} },
  });
  return { db, res, staffReads, historyReads, logs };
}
for (const status of [true, undefined, null]) {
  test(`normal atomic save accepts isActive ${status}`, async () => {
    const db = database({ 'staff/0137': { lastWeight: 200, ...(status === undefined ? {} : { isActive: status }) } });
    const { res } = await post(valid, db);
    assert.equal(res.code, 200);
    assert.equal(db.docs.get('staff/0137').lastWeight, 190);
    const record = db.docs.get(`records/${res.body.recordId}`);
    assert.equal(record.ml, 11.47, 'ignore self-reported ml=999');
    assert.equal(record.weightPrev, 200);
    assert.equal(record.weightNow, 190);
    assert.equal(record.date, 'server-time');
    assert.equal(record.staffId, '0137');
    assert.equal(db.docs.has('staffs/0137'), false);
    assert.equal(db.commits.length, 1);
  });
}
for (const [initial, body, expected] of [
  [{ 'staff/0137': { lastWeight: 200, isActive: false }, 'staffs/0137': { lastWeight: 200 } }, { ...valid, isBottleExchange: true }, 403],
  [{}, valid, 404],
  [{ 'staff/0137': { lastWeight: 199 } }, valid, 409],
  [{ 'staff/0137': { lastWeight: 10 } }, { ...valid, weightPrev: 263 }, 409],
  [{ 'staff/0137': { lastWeight: 200 } }, { ...valid, weightPrev: 10 }, 400],
  [{ 'staff/0137': { lastWeight: 200 } }, { ...valid, weightNow: 45 }, 400],
  [{ 'staff/0137': { lastWeight: 200 } }, { ...valid, weightNow: 264 }, 400],
  [{ 'staff/0137': { lastWeight: 200 } }, { ...valid, weightPrev: null }, 400],
  [{ 'staff/0137': { lastWeight: 200 } }, { ...valid, staffId: [] }, 400],
]) test(`reject ${expected} with zero writes: ${JSON.stringify(body)}`, async () => {
  const db = database(initial);
  const before = JSON.stringify([...db.docs]);
  const { res } = await post(body, db);
  assert.equal(res.code, expected);
  assert.equal(JSON.stringify([...db.docs]), before);
  assert.equal(db.commits.length, 0);
});
for (const backup of [true, false]) test(`exchange atomic save with backup ${backup}`, async () => {
  const db = database({ 'staff/0137': { lastWeight: 100 }, ...(backup ? { 'staffs/0137': { lastWeight: 100, keep: 'unchanged' } } : {}) });
  const { res } = await post({ ...valid, weightPrev: 100, weightNow: 250, isBottleExchange: true }, db);
  assert.equal(res.code, 200);
  assert.equal(res.body.ml, 77.98);
  assert.equal(db.docs.get('staff/0137').lastWeight, 250);
  assert.equal(db.docs.has('staffs/0137'), backup);
  if (backup) assert.deepEqual(db.docs.get('staffs/0137'), { lastWeight: 250, keep: 'unchanged' });
  assert.equal(db.commits.length, 1);
});
test('normal save leaves existing staffs unchanged', async () => {
  const db = database({ 'staff/0137': { lastWeight: 200 }, 'staffs/0137': { lastWeight: 180 } });
  await post(valid, db);
  assert.equal(db.docs.get('staffs/0137').lastWeight, 180);
});
for (const exchange of [false, true]) test(`commit failure rolls back record and all weights, exchange=${exchange}`, async () => {
  const db = database({ 'staff/0137': { lastWeight: 200 }, 'staffs/0137': { lastWeight: 200 }, 'records/old': { ml: 500 } }, true);
  const before = JSON.stringify([...db.docs]);
  const { res } = await post({ ...valid, isBottleExchange: exchange }, db);
  assert.equal(res.code, 500);
  assert.equal(JSON.stringify([...db.docs]), before);
});
for (const [input, id] of [[' ０１３７ ', '0137'], ['９８１５', '9815']]) test(`canonical ID ${input}`, async () => {
  const db = database({ [`staff/${id}`]: { lastWeight: '200' } });
  const { res } = await post({ ...valid, staffId: input }, db);
  assert.equal(res.code, 200);
  assert.equal(res.body.staffId, id);
  assert.equal(db.docs.get(`staff/${id}`).lastWeight, 190);
});
test('canonical retired ID rejects full-width direct POST', async () => {
  const db = database({ 'staff/9815': { lastWeight: 200, isActive: false }, 'staff/９８１５': { lastWeight: 200 } });
  const { res } = await post({ ...valid, staffId: '９８１５' }, db);
  assert.equal(res.code, 403);
  assert.equal(db.commits.length, 0);
});
test('concurrent old previousWeight requests produce one record', async () => {
  const db = database();
  const result = await Promise.all([post(valid, db), post(valid, db)]);
  assert.deepEqual(result.map(r => r.res.code).sort(), [200, 409]);
  assert.equal(db.commits.length, 1);
});
test('retirement committed during a record transaction is detected on retry', async () => {
  const db = database({ 'staff/0137': { lastWeight: 200, isActive: true } }, false, true);
  const { res } = await post(valid, db);
  assert.equal(res.code, 403);
  assert.equal(db.docs.get('staff/0137').lastWeight, 200);
  assert.equal(db.docs.get('staff/0137').isActive, false);
  assert.equal(db.commits.length, 0);
});
test('same-weight zero usage remains a known idempotency limitation', async () => {
  const db = database();
  const body = { ...valid, weightNow: 200 };
  const result = await Promise.all([post(body, db), post(body, db)]);
  assert.deepEqual(result.map(r => r.res.code), [200, 200]);
  assert.equal(db.commits.length, 2);
});
test('server calculation matches both original formulas and rounding', () => {
  for (const previous of [45, 46, 100, 200, 263]) for (const current of [46, 100, 199.999, 200, 250, 263]) {
    let normal = (previous - current) * (250 / (263 - 45));
    if (normal < 0) normal = 0;
    if (normal < 0.01) normal = 0;
    let exchange = ((previous - 45) + (263 - current)) * (250 / 218);
    if (exchange < 0) exchange = 0;
    assert.equal(calculateWeightUsage(previous, current), Number(normal.toFixed(2)));
    assert.equal(calculateWeightUsage(previous, current, true), Number(exchange.toFixed(2)));
  }
});

const saveSource = page.slice(page.indexOf('  const saveRecord = async'), page.indexOf('// ★ 交換ダイアログ'));
async function client(response, { network = false, storageFailure = false, exchange = false, version = "current", updateResponse = false, cleanupFailure = false } = {}) {
  const stored = new Map([['currentStaff', JSON.stringify({ staffId: '0137', lastWeight: 200 })]]);
  const states = [], messages = [], clears = [];
  let calls = 0;
  let updates = 0;
  let operations = 0;
  let cleanups = 0;
  const uncertain = {current:false}, cleanupFailed = {current:false}, ready = {current:true};
  let pending = true;
  const session = new Map();
  const result = await vm.runInNewContext(`${saveSource}\nsaveRecord(999, 190, ${exchange})`, {
    currentRecordStaffId: () => '0137',
    recordFlowRequest, acceptRemeasurementResponse, retryRemeasurement,
    remeasurementRef: {current:idleRemeasurement()}, requestScopeRef: {current:createRecordRequestScope()},
    resetRemeasurement(){}, changeRemeasurement(){}, clearMessageTimer(){}, setShowExchangeConfirm(){},
    operationLifecycleRef: { current: createRecordOperationLifecycle(()=>'01234567-89ab-4cde-8fab-0123456789ab') },
    savePendingRecordOperation, clearPendingRecordOperation, isKnownRecordFailure, isValidRecordSuccess, RECORD_RESULT_UNKNOWN_MESSAGE,
    sessionStorage: { getItem:k=>session.get(k)??null, setItem:(k,v)=>session.set(k,v), removeItem:k=>session.delete(k) },
    clearRecordDraft() { cleanups++; if(cleanupFailure) throw new Error('storage'); },
    readyRef: ready, saveUncertainRef: uncertain, cleanupFailedRef: cleanupFailed, setReady(){}, setDraftNotice(){},
    beginUpdateOperation: () => { operations++; return () => { operations--; }; }, ensureCurrentVersion: async () => version === 'current',
    requireAppUpdate: () => { updates++; }, getAppUpdateState: () => ({required:false}),
    getAppBuildId: () => 'test-build', staff: { staffId: '0137', lastWeight: 200, wardId: '6f' }, wardNameMap: { '6f': '6階' },
    Timestamp: { fromDate: value => value }, window: {}, messageTimerRef: {}, weightUpdateWarning: '再登録せず、管理者に確認してください。',
    fetch: async () => { assert.equal(operations, 1); calls++; if (network) throw new Error('network'); pending = false; return updateResponse ? {ok:false,status:426,json:async()=>({code:'APP_UPDATE_REQUIRED',error:'アプリが更新されました。'})} : response; },
    localStorage: {
      getItem: key => stored.get(key) ?? null,
      setItem: (key, value) => { assert.equal(operations, 1); assert.equal(pending, false); if (storageFailure) throw new Error('quota'); stored.set(key, value); },
    },
    setStaff: value => { assert.equal(pending, false); states.push(value); },
    setMessage: value => messages.push(value), setMessageType() {}, setWeightNow: value => clears.push(value),
    normalMessages: ['normal'], funMessages: ['fun'], mintSpiritMessages: ['mint'], legendaryMintMessages: ['legend'],
    setTimeout: () => 1,
  });
  assert.equal(operations, 0);
  return { result, stored, states, messages, clears, calls, updates, cleanups, uncertain:uncertain.current, ready:ready.current };
}
const success = { ok: true, status:200, json: async () => ({ ok: true, replayed:false, recordId: 'new', staffId: '0137', ml: 11.47, lastWeight: 190 }) };
for (const exchange of [false, true]) test(`client updates weights/history only after success, exchange=${exchange}`, async () => {
  const run = await client(success, { exchange });
  assert.equal(run.result, true);
  assert.equal(run.states[0].lastWeight, 190);
  assert.equal(JSON.parse(run.stored.get('currentStaff')).lastWeight, 190);
  assert.equal(JSON.parse(run.stored.get('staff-0137')).lastWeight, 190);
  const history = JSON.parse(run.stored.get('history'));
  assert.equal(history[0].ml, 11.47);
  assert.equal(history[0].weightPrev, 200);
  assert.equal(history[0].isBottleExchange, exchange);
});
for (const status of [400, 403, 404, 409, 422, 426, 500, 503]) for (const exchange of [false, true]) test(`client HTTP ${status} never updates weights/history, exchange=${exchange}`, async () => {
  const run = await client({ ok: false, status, json: async () => ({ error: 'API error' }) }, { exchange });
  assert.equal(run.result, false);
  assert.equal(run.calls, 1);
  assert.equal(run.states.length, 0);
  assert.equal(run.stored.size, 1);
  assert.equal(JSON.parse(run.stored.get('currentStaff')).lastWeight, 200);
  assert.equal(run.clears.length, 0);
});
test('client network or malformed successful response never applies success state', async () => {
  for (const [response, options] of [[success, { network: true }], [{ ok: true, json: async () => { throw new Error('JSON'); } }, {}]]) {
    const run = await client(response, options);
    assert.equal(run.result, false);
    assert.equal(run.states.length, 0);
    assert.equal(run.stored.size, 1);
  }
});
test('client storage failure after API success is distinct and never re-POSTs', async () => {
  const run = await client(success, { storageFailure: true });
  assert.equal(run.result, false);
  assert.equal(run.calls, 1);
  assert.match(run.messages.at(-1), /記録は保存されましたが/);
});
test('page has no direct Firestore writes; locks and formulas remain', () => {
  assert.doesNotMatch(page, /updateDoc|setDoc|addDoc|runTransaction/);
  assert.match(page, /recordLockRef\.current \|\| isSubmitting/);
  assert.match(page, /if \(exchangeLockRef\.current\) return/);
  const previous = normalizeLineEndings(execFileSync('git', ['show', 'HEAD:pages/record/index.js'], { encoding: 'utf8' }));
  for (const [start, end] of [['  // 旧ボトル：', '  let usedMl ='], ['  // ★ 使用量計算', '  // ★ 二重登録防止']]) {
    const before = previous.slice(previous.indexOf(start), previous.indexOf(end, previous.indexOf(start)));
    const after = page.slice(page.indexOf(start), page.indexOf(end, page.indexOf(start)));
    assert.equal(after.split('  try {')[0].trim(), before.split('  try {')[0].trim());
  }
});
test('GET implementations are unchanged', () => {
  const old = normalizeLineEndings(execFileSync('git', ['show', 'HEAD:pages/api/records.js'], { encoding: 'utf8' }));
  const current = read('pages/api/records.js');
  const getSections = source => source.slice(source.indexOf('  // 全記録を取得'), source.indexOf('  // 記録を修正'));
  assert.equal(getSections(current), getSections(old));
});

for (const version of ['update-required', 'unavailable']) for (const exchange of [false, true]) test(`final preflight ${version} blocks POST, exchange=${exchange}`, async () => {
  const run = await client(success, {version, exchange});
  assert.equal(run.calls,0); assert.equal(run.result,false); assert.equal(run.states.length,0); assert.equal(run.clears.length,0);
});
for (const exchange of [false,true]) test(`426 requests persistent update, retains input, never re-sends, exchange=${exchange}`, async () => {
  const run = await client(success, {exchange, updateResponse:true});
  assert.equal(run.updates,1); assert.equal(run.calls,1); assert.equal(run.result,false);
  assert.equal(run.states.length,0); assert.equal(run.clears.length,0); assert.equal(run.stored.size,1);
});

test('confirmed save deletes draft; cleanup failure never fails or retries the successful record', async () => {
  for (const cleanupFailure of [false,true]) {
    const run=await client(success,{cleanupFailure});
    assert.equal(run.result,true);assert.equal(run.calls,1);assert.equal(run.cleanups,1);
    assert.equal(run.clears[0],'');assert.equal(run.ready,!cleanupFailure);
  }
});
test('unknown save outcome blocks further records and clears reusable draft, without retry',async()=>{
  const run=await client(success,{network:true});
  assert.equal(run.result,false);assert.equal(run.calls,1);assert.equal(run.uncertain,true);assert.equal(run.ready,false);assert.equal(run.cleanups,1);
});

// Step 3-B API integration: real precheck/decision logic, only mocked Firestore reads/writes.
const baseline = (ml=25,n=3) => ({status:n===3?'complete':'insufficient',history:Array.from({length:n},(_,i)=>({
  date:`2026-09-${10+i}T00:00:00Z`,unit:'weight',isBottleExchange:false,weightPrev:250,weightNow:250-ml*218/250,ml,
}))});
const usageBody = ml => ({...valid,weightPrev:250,weightNow:250-ml*218/250});
const weightDb = () => database({'staff/0137':{lastWeight:250,isActive:true},'staffs/0137':{lastWeight:250}});
function noWrites(db,before,expectedTransactions=0) {
  assert.equal(JSON.stringify([...db.docs]),before);assert.equal(db.commits.length,0);assert.equal(db.transactionCalls,expectedTransactions);
}
for(const [options,body,status] of [
 [{method:'OPTIONS'},valid,405],[{buildId:null},valid,503],[{headers:{'x-app-build-id':'old'}},valid,426],
 [{}, {...valid,weightNow:45},400],
])test(`prechecks preserve early ${status} with no staff/history reads`,async()=>{
 const db=database(),before=JSON.stringify([...db.docs]);const run=await post(body,db,options);
 assert.equal(run.res.code,status);assert.equal(run.staffReads,0);assert.equal(run.historyReads,0);noWrites(db,before);
});
for(const [staff,status] of [[null,404],[{lastWeight:250,isActive:false},403],[{lastWeight:249},409],[{lastWeight:null},409]])test(`staff ${status} takes priority over B, no history or transaction`,async()=>{
 const db=database(staff?{'staff/0137':staff}:{}),before=JSON.stringify([...db.docs]);const r=await post(usageBody(150),db);
 assert.equal(r.res.code,status);assert.equal(r.staffReads,1);assert.equal(r.historyReads,0);noWrites(db,before);
});
for(const [ml,m,code,matched] of [[49.99,20,200,[]],[50,25,422,['A']],[50,25.01,200,[]],[60,30,422,['A']],[149.99,100,200,[]],[150,25,422,['B']]])test(`API rounded boundary ${ml}, median ${m}`,async()=>{
 const db=weightDb(),before=JSON.stringify([...db.docs]);const r=await post(usageBody(ml),db,{historyResult:baseline(m)});
 assert.equal(r.res.code,code);assert.equal(r.staffReads,1);assert.equal(r.historyReads,ml>=150?0:1);
 if(code===422){
   noWrites(db,before);assert.equal(r.res.body.code,'WEIGHT_REMEASUREMENT_REQUIRED');assert.deepEqual(r.res.body.matchedRules,matched);
   assert.equal(r.res.body.currentMl,ml);assert.equal(r.res.body.personalRuleEvaluated,ml<150);
   assert.equal(r.res.body.personalMedianMl,ml<150?m:null);
   assert.deepEqual(Object.keys(r.res.body).sort(),['code','error','challenge','previousWeight','weightNow','currentMl','personalMedianMl','personalRuleEvaluated','matchedRules'].sort());
 }else{assert.equal(db.commits.length,1);assert.equal(db.commits[0].length,2);assert.equal(r.res.body.ml,ml);}
});
for(const n of [0,1,2])test(`API exhausted insufficient ${n} still saves under B`,async()=>{
 const db=weightDb();const r=await post(usageBody(100),db,{historyResult:baseline(10,n)});
 assert.equal(r.res.code,200);assert.equal(db.commits.length,1);assert.equal(r.historyReads,1);
});
for(const [options,code] of [
 [{historyResult:{status:'limit_reached',history:null}},'WEIGHT_HISTORY_LIMIT_REACHED'],
 [{historyError:new Error('PRIVATE SDK KEY CONTENT')},'WEIGHT_HISTORY_UNAVAILABLE'],
 [{staffError:new Error('PRIVATE SDK KEY CONTENT')},'STAFF_WEIGHT_UNAVAILABLE'],
])test(`API ${code} is safe stop, no information leak`,async()=>{
 const db=weightDb(),before=JSON.stringify([...db.docs]);const r=await post(usageBody(50),db,options);
 assert.equal(r.res.code,503);assert.equal(r.res.body.code,code);assert.equal(JSON.stringify(r.res.body).includes('PRIVATE'),false);noWrites(db,before);
});
for(const [change,status] of [
 [db=>db.docs.set('staff/0137',{lastWeight:240}),409],
 [db=>db.docs.set('staff/0137',{lastWeight:250,isActive:false}),403],
 [db=>db.docs.delete('staff/0137'),404],
])test(`transaction rechecks changed staff after preflight: ${status}`,async()=>{
 const db=weightDb();const r=await post(usageBody(30),db,{historyResult:baseline(25),afterPrecheck:change});
 assert.equal(r.res.code,status);assert.equal(db.commits.length,0);assert.equal([...db.docs.keys()].some(k=>k.startsWith('records/')),false);assert.equal(db.transactionCalls,1);
});
test('transaction retry does not repeat preflight/history and commits one record reference',async()=>{
 const db=database({'staff/0137':{lastWeight:200,isActive:true}},false,true);
 const r=await post(valid,db);assert.equal(r.res.code,403);assert.equal(r.staffReads,1);assert.equal(r.historyReads,1);assert.equal(db.transactionAttempts,2);assert.equal(db.commits.length,0);
});
test('concurrent transaction retry still commits only one record and history never runs inside callback',async()=>{
 const db=database();const r=await Promise.all([post(valid,db),post(valid,db)]);
 assert.deepEqual(r.map(x=>x.res.code).sort(),[200,409]);assert.equal(db.commits.length,1);
 assert.ok(db.transactionAttempts>db.transactionCalls);assert.equal(r.reduce((n,x)=>n+x.historyReads,0),2);
});
test('exchange even above 150 keeps existing formula, no history, atomic existing backup sync',async()=>{
 const db=database({'staff/0137':{lastWeight:250},'staffs/0137':{lastWeight:100}});
 const r=await post({...valid,weightPrev:250,weightNow:200,isBottleExchange:true},db);
 assert.equal(r.res.code,200);assert.ok(r.res.body.ml>150);assert.equal(r.historyReads,0);assert.equal(r.staffReads,1);
 assert.equal(db.commits[0].length,3);assert.equal(db.docs.get('staffs/0137').lastWeight,200);
});
test('preflight uses rounded currentMl at the 50mL threshold',async()=>{
 const r=await post(usageBody(49.999),weightDb(),{historyResult:baseline(25)});assert.equal(r.res.code,422);assert.equal(r.res.body.currentMl,50);
});
test('transaction callback has no external precheck/history/HTTP side effects',()=>{
 const lookupStart=apiSource.indexOf('const readCompletedOperation =');
 const start=apiSource.indexOf('const result = await runTransaction');const end=apiSource.indexOf('if (result.status !== 200)',start);
 assert.ok(lookupStart>=0 && start>lookupStart && end>start);
 const lookup=apiSource.slice(lookupStart,apiSource.indexOf('\n      if (operationContext)',lookupStart));
 const callback=apiSource.slice(start,end);
 for(const source of [lookup,callback])assert.doesNotMatch(source,/precheckWeightRemeasurement|evaluateWeightRemeasurementFlow|fetchRecentNormalWeightHistory|issueWeightChallenge|res\.status|res\.json/);
 assert.match(callback,/calculateWeightUsage\(dbWeight, nowWeight, exchange\)/);
 assert.equal((callback.match(/transaction\.set\(/g)||[]).length,2);
});

for(const path of ['pages/record/index.js','pages/api/records.js'])test(`source normalization accepts LF/CRLF but preserves code and indentation: ${path}`,()=>{
 const lf=read(path),crlf=lf.replace(/\n/g,'\r\n');
 assert.ok(lf.includes('\n'));assert.equal(normalizeLineEndings(crlf),lf);assert.equal(normalizeLineEndings(lf),lf);
 // These differences must remain detectable, including indentation at an internal line.
 const indented=lf.replace(/\n/, '\n ');
 assert.notEqual(indented,lf);assert.notEqual(normalizeLineEndings(indented),lf);
 const changed=lf.replace('const ', 'let ');
 assert.notEqual(changed,lf);assert.notEqual(normalizeLineEndings(changed),lf);
});

// Completed API flow, with real cryptography and entirely mocked database operations.
const integrationSecret='fixture-integration-secret-at-least-32-bytes';
const integrationNow=Date.UTC(2026,9,21);
const flowOptions={historyResult:baseline(25),now:()=>integrationNow};
const tokenFor=(stage='remeasure',changes={})=>issueWeightChallenge({stage,staffId:'0137',previousWeight:250,weightNow:usageBody(100).weightNow,currentMl:100,
 appBuildId:'test-build',ruleVersion:WEIGHT_REMEASUREMENT_RULE_VERSION,matchedRules:['A'],personalMedianMl:25,baselineCount:3,personalRuleEvaluated:true,...changes},
 {secret:integrationSecret,nowMs:integrationNow});
test('completed API flow: first A and then B write nothing, explicit confirmation saves atomically',async()=>{
 const db=weightDb(),before=JSON.stringify([...db.docs]);
 const a=await post({...usageBody(100),operation:'normal'},db,flowOptions);assert.equal(a.res.code,422);noWrites(db,before);
 assert.equal(verifyWeightChallenge(a.res.body.challenge,{secret:integrationSecret,nowMs:integrationNow,expectedStage:'remeasure'}).stage,'remeasure');
 const b=await post({...usageBody(110),operation:'remeasure',challenge:a.res.body.challenge},db,flowOptions);assert.equal(b.res.code,422);
 assert.equal(b.res.body.code,'WEIGHT_REMEASUREMENT_CONFIRMATION_REQUIRED');noWrites(db,before);
 const saved=await post({...usageBody(110),operation:'confirm_remeasurement',challenge:b.res.body.challenge},db,flowOptions);
 assert.equal(saved.res.code,200);assert.equal(saved.res.body.ml,110);assert.equal(db.commits.length,1);assert.equal(db.commits[0].length,2);
 assert.equal(db.docs.get('staff/0137').lastWeight,usageBody(110).weightNow);
});
test('A permits a changed normal remeasurement, which saves without a second confirmation',async()=>{
 const db=weightDb();const a=await post(usageBody(100),db,flowOptions);
 const saved=await post({...usageBody(30),operation:'remeasure',challenge:a.res.body.challenge},db,flowOptions);
 assert.equal(saved.res.code,200);assert.equal(saved.res.body.ml,30);assert.equal(db.commits.length,1);
});
for(const [ml,expected] of [[30,200],[100,503]])test(`secret absent, ${ml}mL: ${expected}`,async()=>{
 const db=weightDb(),before=JSON.stringify([...db.docs]);const r=await post(usageBody(ml),db,{...flowOptions,secret:null});assert.equal(r.res.code,expected);
 if(expected===503){assert.equal(r.res.body.code,'WEIGHT_CHALLENGE_UNAVAILABLE');noWrites(db,before);}
});
for(const operation of ['remeasure','confirm_remeasurement'])for(const [label,changes,expected,code] of [
 ['tamper',{challenge:tokenFor()+'x'},400,'WEIGHT_CHALLENGE_INVALID'],
 ['wrong stage',{challenge:tokenFor(operation==='remeasure'?'confirm':'remeasure')},400,'WEIGHT_CHALLENGE_WRONG_STAGE'],
 ['staff',{staffId:'other'},409,'WEIGHT_CHALLENGE_STAFF_MISMATCH'],
 ['previous',{weightPrev:249},409,'WEIGHT_CHALLENGE_PREVIOUS_WEIGHT_MISMATCH'],
 ['app',{challenge:tokenFor(operation==='remeasure'?'remeasure':'confirm',{appBuildId:'different'})},409,'WEIGHT_CHALLENGE_APP_VERSION_MISMATCH'],
 ['rule',{challenge:tokenFor(operation==='remeasure'?'remeasure':'confirm',{ruleVersion:'different'})},409,'WEIGHT_CHALLENGE_RULE_VERSION_MISMATCH'],
 ['exchange',{isBottleExchange:true},400,undefined],
])test(`${operation} ${label} rejected with zero reads/writes`,async()=>{
 const db=weightDb(),before=JSON.stringify([...db.docs]);
 const r=await post({...usageBody(100),operation,challenge:tokenFor(operation==='remeasure'?'remeasure':'confirm'),...changes},db,flowOptions);
 assert.equal(r.res.code,expected);assert.equal(r.res.body.code,code);assert.equal(r.staffReads,0);assert.equal(r.historyReads,0);noWrites(db,before);
});
for(const operation of ['remeasure','confirm_remeasurement'])test(`${operation} expired before reads`,async()=>{
 const db=weightDb(),r=await post({...usageBody(100),operation,challenge:tokenFor(operation==='remeasure'?'remeasure':'confirm')},db,{...flowOptions,now:()=>integrationNow+600000});
 assert.equal(r.res.code,422);assert.equal(r.res.body.code,'WEIGHT_CHALLENGE_EXPIRED');assert.equal(r.staffReads,0);assert.equal(db.commits.length,0);
});
test('A cannot be used for immediate confirmation and B cannot confirm a different weight',async()=>{
 for(const [challenge,weight,code] of [[tokenFor(),100,'WEIGHT_CHALLENGE_WRONG_STAGE'],[tokenFor('confirm'),110,'WEIGHT_CONFIRMATION_CHANGED']]){
  const db=weightDb(),r=await post({...usageBody(weight),operation:'confirm_remeasurement',challenge},db,flowOptions);
  assert.equal(r.res.body.code,code);assert.equal(r.staffReads,0);assert.equal(db.commits.length,0);
 }
});
for(const [changed,expected] of [[{lastWeight:250,isActive:false},403],[{lastWeight:240},409]])test(`confirmation transaction rechecks changed staff: ${expected}`,async()=>{
 const db=weightDb(),r=await post({...usageBody(100),operation:'confirm_remeasurement',challenge:tokenFor('confirm')},db,{...flowOptions,afterPrecheck:d=>d.docs.set('staff/0137',changed)});
 assert.equal(r.res.code,expected);assert.equal(db.commits.length,0);assert.equal(db.transactionCalls,1);
});
for(const operation of ['remeasure','confirm_remeasurement'])test(`${operation}: expiration between flow and transaction prevents all writes`,async()=>{
 let clock=integrationNow;const db=weightDb();const r=await post({...usageBody(operation==='remeasure'?30:100),operation,challenge:tokenFor(operation==='remeasure'?'remeasure':'confirm')},db,
 {...flowOptions,now:()=>clock,afterPrecheck:()=>{clock=integrationNow+600000;}});
 assert.equal(r.res.code,422);assert.equal(r.res.body.code,'WEIGHT_CHALLENGE_EXPIRED');assert.equal(db.transactionCalls,1);assert.equal(db.commits.length,0);
});
test('concurrent final confirmations: transaction retry never reruns flow/history or duplicates record',async()=>{
 const db=weightDb(),body={...usageBody(100),operation:'confirm_remeasurement',challenge:tokenFor('confirm')};
 const r=await Promise.all([post(body,db,flowOptions),post(body,db,flowOptions)]);assert.deepEqual(r.map(x=>x.res.code).sort(),[200,409]);
 assert.equal(db.commits.length,1);assert.ok(db.transactionAttempts>db.transactionCalls);assert.equal(r.reduce((n,x)=>n+x.historyReads,0),2);
});
test('unknown operation rejected and raw exception details never logged',async()=>{
 for(const operation of ['initial','bad',null]){const db=weightDb();const r=await post({...usageBody(100),operation},db,flowOptions);assert.equal(r.res.code,400);assert.equal(r.staffReads,0);}
 const r=await post(usageBody(30),weightDb(),{afterPrecheck:()=>{throw new Error('PRIVATE secret token '+tokenFor());}});
 assert.equal(r.res.code,500);assert.equal(JSON.stringify(r.logs).includes('PRIVATE'),false);assert.equal(JSON.stringify(r.res.body).includes('PRIVATE'),false);
});

for(const operation of ['remeasure','confirm_remeasurement'])test(`${operation} with missing secret stops before staff read`,async()=>{
 const db=weightDb(),before=JSON.stringify([...db.docs]);
 const r=await post({...usageBody(100),operation,challenge:tokenFor(operation==='remeasure'?'remeasure':'confirm')},db,{...flowOptions,secret:null});
 assert.equal(r.res.code,503);assert.equal(r.res.body.code,'WEIGHT_CHALLENGE_UNAVAILABLE');assert.equal(r.staffReads,0);noWrites(db,before);
});
test('valid signed display ml is ignored by final API save',async()=>{
 const db=weightDb(),r=await post({...usageBody(100),operation:'confirm_remeasurement',challenge:tokenFor('confirm',{currentMl:1})},db,flowOptions);
 assert.equal(r.res.code,200);assert.equal(r.res.body.ml,100);assert.equal(db.docs.get(`records/${r.res.body.recordId}`).ml,100);
});
test('challenge expiration on transaction RETRY is rechecked without new challenge/history query',async()=>{
 let clock=integrationNow;
 const db=database({'staff/0137':{lastWeight:250,isActive:true}},false,false,()=>{clock=integrationNow+300000;});
 const r=await post({...usageBody(100),operation:'confirm_remeasurement',challenge:tokenFor('confirm')},db,{...flowOptions,now:()=>clock});
 assert.equal(r.res.code,422);assert.equal(r.res.body.code,'WEIGHT_CHALLENGE_EXPIRED');assert.equal(db.transactionAttempts,2);
 assert.equal(r.staffReads,1);assert.equal(r.historyReads,1);assert.equal(db.commits.length,0);assert.equal(db.docs.get('staff/0137').lastWeight,250);
});

const boundOperationId='01234567-89ab-4cde-8fab-0123456789ab';
const differentOperationId='01234567-89ab-4cde-9fab-0123456789ab';
test('API passes operation ID through A/B and atomically persists only successful operation',async()=>{
 const db=weightDb(),options=flowOptions,operationId=boundOperationId;
 const a=await post({...usageBody(100),operationId},db,options);assert.equal(a.res.code,422);assert.equal(db.commits.length,0);
 const b=await post({...usageBody(110),operation:'remeasure',challenge:a.res.body.challenge,operationId},db,options);
 assert.equal(b.res.code,422);assert.equal(db.commits.length,0);
 const p=verifyWeightChallenge(b.res.body.challenge,{secret:integrationSecret,nowMs:integrationNow,expectedStage:'confirm',expectedOperationId:operationId});
 assert.equal(p.operationId,operationId);
 const final=await post({...usageBody(110),operation:'confirm_remeasurement',challenge:b.res.body.challenge,operationId},db,options);
 assert.equal(final.res.code,200);assert.equal(final.res.body.ml,110);assert.equal(db.transactionCalls,6);
 const record=db.docs.get(`records/${final.res.body.recordId}`);assert.equal(record.operationId,operationId);
 assert.equal(db.docs.get(`recordOperations/${operationId}`).recordId,final.res.body.recordId);
});
for(const operation of ['remeasure','confirm_remeasurement'])for(const operationId of [undefined,differentOperationId])test(`API ${operation} bound ID ${operationId===undefined?'missing':'changed'} has no precheck/history reads or writes`,async()=>{
 const db=weightDb(),before=JSON.stringify([...db.docs]);
 const challenge=tokenFor(operation==='remeasure'?'remeasure':'confirm',{operationId:boundOperationId});
 const r=await post({...usageBody(100),operation,challenge,operationId},db,flowOptions);
 assert.equal(r.res.code,409);assert.equal(r.res.body.code,'WEIGHT_CHALLENGE_OPERATION_MISMATCH');
 assert.equal(r.staffReads,0);assert.equal(r.historyReads,0);noWrites(db,before,operationId===undefined?0:2);
});
test('API refuses legacy token upgrade, invalid ID and bound request with missing secret',async()=>{
 for(const [body,options,status,code] of [
  [{...usageBody(100),operation:'remeasure',challenge:tokenFor(),operationId:boundOperationId},flowOptions,409,'WEIGHT_CHALLENGE_OPERATION_MISMATCH'],
  [{...usageBody(30),operationId:'bad'},flowOptions,400,'INVALID_OPERATION_REQUEST'],
  [{...usageBody(100),operationId:boundOperationId},{...flowOptions,secret:null},503,'WEIGHT_CHALLENGE_UNAVAILABLE'],
 ]) {
  const db=weightDb(),before=JSON.stringify([...db.docs]);const r=await post(body,db,options);
  assert.equal(r.res.code,status);assert.equal(r.res.body.code,code);noWrites(db,before,status===400?0:2);
 }
});
for(const [exchange,now] of [[false,190],[false,200],[true,200]])test(`aware ordinary save remains valid: exchange ${exchange}, now ${now}`,async()=>{
 const db=database();const r=await post({...valid,weightNow:now,isBottleExchange:exchange,operationId:boundOperationId},db);
 assert.equal(r.res.code,200);assert.equal(r.res.body.ml,calculateWeightUsage(200,now,exchange));assert.equal(db.commits.length,1);
});
test('bound confirmation still fails when expiry is reached on transaction retry',async()=>{
 let clock=integrationNow;const db=database({'staff/0137':{lastWeight:250,isActive:true}},false,false,()=>{clock=integrationNow+300000;});
 const r=await post({...usageBody(100),operation:'confirm_remeasurement',operationId:boundOperationId,
  challenge:tokenFor('confirm',{operationId:boundOperationId})},db,{...flowOptions,now:()=>clock});
 assert.equal(r.res.code,422);assert.equal(r.res.body.code,'WEIGHT_CHALLENGE_EXPIRED');assert.equal(db.transactionAttempts,3);assert.equal(db.commits.length,0);
});
test('operation-aware remeasurement may change weight and save a normal result',async()=>{
 const db=weightDb(),operationId=boundOperationId;
 const a=await post({...usageBody(100),operationId},db,flowOptions);
 const saved=await post({...usageBody(30),operation:'remeasure',challenge:a.res.body.challenge,operationId},db,flowOptions);
 assert.equal(saved.res.code,200);assert.equal(saved.res.body.ml,30);assert.equal(db.commits.length,1);
});
for(const [change,status] of [[{isActive:false,lastWeight:250},403],[{lastWeight:240},409]])test(`aware confirmation transaction preserves ${status} safety check`,async()=>{
 const db=weightDb();const r=await post({...usageBody(100),operation:'confirm_remeasurement',operationId:boundOperationId,
  challenge:tokenFor('confirm',{operationId:boundOperationId})},db,{...flowOptions,afterPrecheck:d=>d.docs.set('staff/0137',change)});
 assert.equal(r.res.code,status);assert.equal(db.transactionCalls,2);assert.equal(db.commits.length,0);
});
test('operation-aware B rejects edited weight before reads',async()=>{
 const db=weightDb();const r=await post({...usageBody(100),weightNow:usageBody(100).weightNow+1,
  operation:'confirm_remeasurement',operationId:boundOperationId,challenge:tokenFor('confirm',{operationId:boundOperationId})},db,flowOptions);
 assert.equal(r.res.code,409);assert.equal(r.res.body.code,'WEIGHT_CONFIRMATION_CHANGED');assert.equal(r.staffReads,0);assert.equal(db.commits.length,0);
});

const awareBody=(changes={})=>({...valid,operationId:boundOperationId,...changes});
const recordCount=db=>[...db.docs.keys()].filter(key=>key.startsWith('records/')).length;
const operationCount=db=>[...db.docs.keys()].filter(key=>key.startsWith('recordOperations/')).length;
function sameSuccess(first,replay) {
 assert.equal(first.res.code,200);assert.equal(replay.res.code,200);assert.equal(replay.res.body.replayed,true);
 const {replayed:initialMarker,...initialResult}=first.res.body;
 const {replayed:replayMarker,...replayResult}=replay.res.body;
 assert.equal(initialMarker,false);assert.deepEqual(replayResult,initialResult);
}
test('aware normal replay returns original result before stale previousWeight/history validation',async()=>{
 const db=database(),body=awareBody(),first=await post(body,db);
 assert.equal(first.res.code,200);assert.equal(first.res.body.ml,11.47);assert.equal(recordCount(db),1);assert.equal(operationCount(db),1);
 assert.equal(db.commits[0].length,3);
 const before=JSON.stringify([...db.docs]),commits=db.commits.length;
 const replay=await post(body,db,{historyError:new Error('must not read'),staffError:new Error('must not precheck')});
 sameSuccess(first,replay);assert.equal(replay.staffReads,0);assert.equal(replay.historyReads,0);
 assert.equal(JSON.stringify([...db.docs]),before);assert.equal(db.commits.length,commits);
 assert.equal(db.docs.get('staff/0137').lastWeight,190);
});
for(const exchange of [false,true])test(`same-weight replay is one record, exchange=${exchange}`,async()=>{
 const db=database({'staff/0137':{lastWeight:200},'staffs/0137':{lastWeight:200}});
 const body=awareBody({weightNow:200,isBottleExchange:exchange}),first=await post(body,db),again=await post(body,db);
 sameSuccess(first,again);assert.equal(recordCount(db),1);assert.equal(operationCount(db),1);
 assert.equal(first.res.body.ml,exchange?250:0);assert.equal(db.commits.length,1);
 assert.equal(db.docs.get('staff/0137').lastWeight,200);assert.equal(db.docs.get('staffs/0137').lastWeight,200);
});
for(const exchange of [false,true])test(`different IDs permit two formal same-weight operations, exchange=${exchange}`,async()=>{
 const db=database();const first=await post(awareBody({weightNow:200,isBottleExchange:exchange}),db);
 const second=await post(awareBody({weightNow:200,isBottleExchange:exchange,operationId:differentOperationId}),db);
 assert.equal(first.res.code,200);assert.equal(second.res.code,200);assert.notEqual(first.res.body.recordId,second.res.body.recordId);
 assert.equal(recordCount(db),2);assert.equal(operationCount(db),2);
 assert.equal(first.res.body.ml+second.res.body.ml,exchange?500:0);
});
for(const changes of [{weightNow:189},{weightPrev:201},{isBottleExchange:true},{operation:'remeasure'},
 {operation:'confirm_remeasurement'},{name:'Changed'},{department:'外来'},{wardId:'gairai'},{unit:'cm'},{mintPoint:2},{amount:20}]) {
 test(`same ID different saved request rejects ${Object.keys(changes)[0]} ${changes.operation??''}`,async()=>{
  const db=database(),body=awareBody();await post(body,db);const before=JSON.stringify([...db.docs]);
  const r=await post({...body,...changes},db);assert.equal(r.res.code,409);assert.equal(r.res.body.code,'OPERATION_ID_REUSED_WITH_DIFFERENT_REQUEST');
  assert.equal(JSON.stringify([...db.docs]),before);assert.equal(db.commits.length,1);assert.equal(r.historyReads,0);
 });
}
test('same ID cannot be reused by a different existing staff member',async()=>{
 const db=database({'staff/0137':{lastWeight:200},'staff/9815':{lastWeight:200}});await post(awareBody(),db);
 const r=await post(awareBody({staffId:'9815'}),db);assert.equal(r.res.code,409);
 assert.equal(r.res.body.code,'OPERATION_ID_REUSED_WITH_DIFFERENT_REQUEST');assert.equal(db.docs.get('staff/9815').lastWeight,200);assert.equal(recordCount(db),1);
});
for(const exchange of [false,true])test(`concurrent same-ID requests commit once, exchange=${exchange}`,async()=>{
 const db=database(),body=awareBody({weightNow:200,isBottleExchange:exchange});
 const [first,second]=await Promise.all([post(body,db),post(body,db)]);
 assert.equal(first.res.code,200);assert.equal(second.res.code,200);assert.equal(first.res.body.recordId,second.res.body.recordId);
 assert.equal(first.res.body.ml,second.res.body.ml);assert.equal(recordCount(db),1);assert.equal(operationCount(db),1);assert.equal(db.commits.length,1);
 assert.ok(db.transactionAttempts>db.transactionCalls);
 const receipt=db.docs.get(`recordOperations/${body.operationId}`);
 assert.equal(receipt.recordId,first.res.body.recordId);assert.equal(receipt.requestDigest,prepareRecordOperation(body.operationId,body).requestDigest);
});
test('precheck observes another completed request after initial missing lookup: replay rather than stale 409',async()=>{
 const db=database(),body=awareBody();let first;
 const r=await post(body,db,{beforePrecheck:async()=>{first=await post(body,db);}});
 sameSuccess(first,r);assert.equal(recordCount(db),1);assert.equal(db.commits.length,1);assert.equal(r.historyReads,0);
});
test('receipt recheck also resolves a precheck history error after another request commits',async()=>{
 const db=database(),body=awareBody({weightNow:200});let first;
 const r=await post(body,db,{beforePrecheck:async()=>{first=await post(body,db);},historyError:new Error('offline')});
 sameSuccess(first,r);assert.equal(db.commits.length,1);assert.equal(recordCount(db),1);
});
test('concurrent requests that reuse ID for different content cannot both commit',async()=>{
 const db=database();const replies=await Promise.all([post(awareBody({weightNow:200}),db),post(awareBody({weightNow:199}),db)]);
 assert.deepEqual(replies.map(r=>r.res.code).sort(),[200,409]);assert.equal(recordCount(db),1);assert.equal(operationCount(db),1);
 assert.equal(replies.find(r=>r.res.code===409).res.body.code,'OPERATION_ID_REUSED_WITH_DIFFERENT_REQUEST');
});
test('transaction failure leaves record, staff, backup and operation entirely unchanged',async()=>{
 const db=database({'staff/0137':{lastWeight:200},'staffs/0137':{lastWeight:190}},true);
 const before=JSON.stringify([...db.docs]);const r=await post(awareBody({weightNow:200,isBottleExchange:true}),db);
 assert.equal(r.res.code,500);assert.equal(JSON.stringify([...db.docs]),before);assert.equal(db.commits.length,0);assert.equal(operationCount(db),0);
});
test('transaction retry preserves generated record ID, result and digest atomically',async()=>{
 const db=database(undefined,false,false,()=>{}),body=awareBody();const r=await post(body,db);
 assert.equal(r.res.code,200);assert.equal(db.transactionAttempts,3);assert.equal(recordCount(db),1);
 const receipt=db.docs.get(`recordOperations/${body.operationId}`);assert.equal(receipt.recordId,r.res.body.recordId);
 assert.equal(receipt.result.recordId,r.res.body.recordId);assert.equal(receipt.requestDigest,prepareRecordOperation(body.operationId,body).requestDigest);
});
test('aware A to normal save replay is one record even after token expires',async()=>{
 const db=weightDb(),operationId=boundOperationId;
 const a=await post({...usageBody(100),operationId},db,flowOptions);assert.equal(a.res.code,422);assert.equal(operationCount(db),0);
 const body={...usageBody(30),operationId,operation:'remeasure',challenge:a.res.body.challenge};
 const first=await post(body,db,flowOptions),replay=await post(body,db,{...flowOptions,now:()=>integrationNow+3600000,secret:null});
 sameSuccess(first,replay);assert.equal(recordCount(db),1);assert.equal(replay.historyReads,0);assert.equal(replay.staffReads,0);
});
test('aware A to B confirmation replay is one record and returns historical result without weight rollback',async()=>{
 const db=weightDb(),operationId=boundOperationId;
 const a=await post({...usageBody(100),operationId},db,flowOptions);
 const b=await post({...usageBody(110),operationId,operation:'remeasure',challenge:a.res.body.challenge},db,flowOptions);
 assert.equal(b.res.code,422);assert.equal(operationCount(db),0);assert.equal(recordCount(db),0);
 const body={...usageBody(110),operationId,operation:'confirm_remeasurement',challenge:b.res.body.challenge};
 const first=await post(body,db,flowOptions);db.docs.set('staff/0137',{lastWeight:100});const before=JSON.stringify([...db.docs]);
 const replay=await post(body,db,{...flowOptions,now:()=>integrationNow+3600000});
 sameSuccess(first,replay);assert.equal(JSON.stringify([...db.docs]),before);assert.equal(recordCount(db),1);assert.equal(db.docs.get('staff/0137').lastWeight,100);
});
for(const [method,changes,options,status] of [
 ['version',null,{headers:{'x-app-build-id':'old'}},426],
 ['inactive',{lastWeight:190,isActive:false},{},403],['missing',null,{},404],
])test(`completed receipt does not bypass ${method}`,async()=>{
 const db=database(),body=awareBody();await post(body,db);
 if(method==='inactive')db.docs.set('staff/0137',changes);if(method==='missing')db.docs.delete('staff/0137');
 const before=JSON.stringify([...db.docs]);const r=await post(body,db,options);
 assert.equal(r.res.code,status);assert.equal(JSON.stringify([...db.docs]),before);assert.equal(db.commits.length,1);
 if(status===426)assert.equal(r.db.transactionCalls,2);
});
test('uncommitted expired bound challenge still rejects without any receipt',async()=>{
 const db=weightDb(),before=JSON.stringify([...db.docs]);const body={...usageBody(100),operationId:boundOperationId,
  operation:'confirm_remeasurement',challenge:tokenFor('confirm',{operationId:boundOperationId})};
 const r=await post(body,db,{...flowOptions,now:()=>integrationNow+600000});
 assert.equal(r.res.code,422);assert.equal(r.res.body.code,'WEIGHT_CHALLENGE_EXPIRED');noWrites(db,before,2);
});
test('canonical equivalent requests replay despite key order, full-width ID and ignored client fields',async()=>{
 const db=database(),body=awareBody();const first=await post(body,db);
 const shuffled=Object.fromEntries(Object.entries({...body,staffId:' ０１３７ ',weightPrev:'200.00',weightNow:'190.0',mintPoint:'1',ml:9999,date:'ignored'}).reverse());
 sameSuccess(first,await post(shuffled,db));assert.equal(db.commits.length,1);
});
test('success receipt stores only minimal result and digest; legacy data has no fabricated ID',async()=>{
 const db=database(),body=awareBody({secret:'PRIVATE',arbitrary:{hidden:'PRIVATE'}});const r=await post(body,db);
 assert.equal(r.res.code,200);const receipt=db.docs.get(`recordOperations/${body.operationId}`);
 assert.deepEqual(Object.keys(receipt).sort(),['schemaVersion','resultVersion','staffId','requestDigest','recordId','result','committedAt'].sort());
 assert.deepEqual(Object.keys(receipt.result).sort(),['ok','recordId','staffId','lastWeight','ml'].sort());
 for(const word of ['PRIVATE','name','department','challenge','secret','weightPrev','body'])assert.equal(JSON.stringify(receipt).includes(word),false);
 assert.equal(db.docs.get(`records/${r.res.body.recordId}`).operationId,body.operationId);
 const legacy=database();const saved=await post(valid,legacy);assert.equal(saved.res.code,200);
 assert.equal('operationId'in legacy.docs.get(`records/${saved.res.body.recordId}`),false);assert.equal(operationCount(legacy),0);
});
test('corrupt saved receipt fails closed and is never overwritten or leaked',async()=>{
 const db=database(),body=awareBody();await post(body,db);
 const ref=`recordOperations/${body.operationId}`;db.docs.set(ref,{...db.docs.get(ref),result:{ok:true,secret:'PRIVATE'}});
 const before=JSON.stringify([...db.docs]);const r=await post(body,db);
 assert.equal(r.res.code,503);assert.equal(r.res.body.code,'OPERATION_RESULT_UNAVAILABLE');
 assert.equal(JSON.stringify(r.res.body).includes('PRIVATE'),false);assert.equal(JSON.stringify([...db.docs]),before);assert.equal(recordCount(db),1);
});
test('receipt read failure stops safely; legacy requests never access the new collection',async()=>{
 const db=database(),original=db.runTransaction;
 db.runTransaction=(dbArg,callback)=>original(dbArg,transaction=>callback({...transaction,get:async ref=>{
  if(ref.key.startsWith('recordOperations/'))throw new Error('PRIVATE read failure');
  return transaction.get(ref);
 }}));
 const before=JSON.stringify([...db.docs]),failed=await post(awareBody(),db);
 assert.equal(failed.res.code,500);assert.equal(JSON.stringify(failed.res.body).includes('PRIVATE'),false);
 assert.equal(JSON.stringify([...db.docs]),before);assert.equal(db.commits.length,0);
 const legacy=await post(valid,db);assert.equal(legacy.res.code,200);assert.equal(operationCount(db),0);
});
test('retirement on aware commit retry prevents record and operation document together',async()=>{
 const db=database(undefined,false,true);const r=await post(awareBody(),db);
 assert.equal(r.res.code,403);assert.equal(recordCount(db),0);assert.equal(operationCount(db),0);assert.equal(db.commits.length,0);
 assert.equal(db.docs.get('staff/0137').lastWeight,200);assert.equal(db.transactionAttempts,3);
});
test('same-ID normal decreasing concurrent requests both get the same original result',async()=>{
 const db=database(),body=awareBody();const replies=await Promise.all([post(body,db),post(body,db)]);
 assert.deepEqual(replies.map(r=>r.res.code),[200,200]);assert.equal(replies[0].res.body.recordId,replies[1].res.body.recordId);
 assert.equal(recordCount(db),1);assert.equal(operationCount(db),1);assert.equal(db.docs.get('staff/0137').lastWeight,190);
});
test('bound final confirmation concurrent replay returns one successful record to both callers',async()=>{
 const db=weightDb(),body={...usageBody(100),operation:'confirm_remeasurement',operationId:boundOperationId,
  challenge:tokenFor('confirm',{operationId:boundOperationId})};
 const replies=await Promise.all([post(body,db,flowOptions),post(body,db,flowOptions)]);
 assert.deepEqual(replies.map(r=>r.res.code),[200,200]);assert.equal(replies[0].res.body.recordId,replies[1].res.body.recordId);
 assert.equal(recordCount(db),1);assert.equal(operationCount(db),1);assert.equal(db.commits.length,1);
});
