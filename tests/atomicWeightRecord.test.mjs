import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';
import { isActiveStaff } from '../utils/isActiveStaff.js';
import { calculateWeightUsage } from '../utils/calculateWeightUsage.js';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const apiSource = read('pages/api/records.js').replace(/import[\s\S]*?from\s+["'][^"']+["'];\s*/g, '').replace('export default ', '');
const page = read('pages/record/index.js');
const valid = { staffId: '0137', name: 'Staff', wardId: '6f', department: '6階', weightPrev: 200, weightNow: 190, isBottleExchange: false, ml: 999, mintPoint: 1 };

// Atomic staged writes, with version-based retries to model Firestore transactions.
function database(initial = { 'staff/0137': { lastWeight: 200, isActive: true } }, failure = false, retireBeforeCommit = false) {
  const docs = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  let version = 0, serial = 0, reads = 0;
  const commits = [];
  return { docs, commits, get reads() { return reads; },
    doc(...args) {
      const key = args.length === 1 ? `${args[0]}/new-${++serial}` : `${args[1]}/${args[2]}`;
      return { key, id: key.split('/').at(-1) };
    },
    async runTransaction(_, callback) {
      for (;;) {
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
async function post(body = valid, db = database()) {
  const res = { status(code) { this.code = code; return this; }, json(data) { this.body = JSON.parse(JSON.stringify(data)); return this; } };
  await vm.runInNewContext(`${apiSource}\nhandler(req, res)`, {
    db: {}, doc: db.doc, runTransaction: db.runTransaction,
    collection: (_, name) => name, Timestamp: { now: () => 'server-time' },
    normalizeStaffId, isActiveStaff, calculateWeightUsage, getAppBuildId: () => "test-build",
    req: { method: 'POST', body, headers: { 'x-app-build-id': 'test-build' } }, res, console: { error() {} },
  });
  return { db, res };
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
async function client(response, { network = false, storageFailure = false, exchange = false, version = "current", updateResponse = false } = {}) {
  const stored = new Map([['currentStaff', JSON.stringify({ staffId: '0137', lastWeight: 200 })]]);
  const states = [], messages = [], clears = [];
  let calls = 0;
  let updates = 0;
  let operations = 0;
  let pending = true;
  const result = await vm.runInNewContext(`${saveSource}\nsaveRecord(999, 190, ${exchange})`, {
    beginUpdateOperation: () => { operations++; return () => { operations--; }; }, ensureCurrentVersion: async () => version === 'current',
    requireAppUpdate: () => { updates++; }, getAppUpdateState: () => ({required:false}),
    getAppBuildId: () => 'test-build', staff: { staffId: '0137', lastWeight: 200, wardId: '6f' }, wardNameMap: { '6f': '6階' },
    Timestamp: { fromDate: value => value }, window: {}, messageTimerRef: {}, weightUpdateWarning: '再登録せず、管理者に確認してください。',
    fetch: async () => { assert.equal(operations, 1); calls++; if (network) throw new Error('network'); pending = false; return updateResponse ? {ok:false,status:426,json:async()=>({code:'APP_UPDATE_REQUIRED'})} : response; },
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
  return { result, stored, states, messages, clears, calls, updates };
}
const success = { ok: true, json: async () => ({ ok: true, recordId: 'new', staffId: '0137', ml: 11.47, lastWeight: 190 }) };
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
for (const status of [400, 403, 404, 409, 426, 500]) for (const exchange of [false, true]) test(`client HTTP ${status} never updates weights/history, exchange=${exchange}`, async () => {
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
  const previous = execFileSync('git', ['show', 'HEAD:pages/record/index.js'], { encoding: 'utf8' });
  for (const [start, end] of [['  // 旧ボトル：', '  let usedMl ='], ['  // ★ 使用量計算', '  // ★ 二重登録防止']]) {
    const before = previous.slice(previous.indexOf(start), previous.indexOf(end, previous.indexOf(start)));
    const after = page.slice(page.indexOf(start), page.indexOf(end, page.indexOf(start)));
    assert.equal(after.split('  try {')[0].trim(), before.split('  try {')[0].trim());
  }
});
test('GET implementations are unchanged', () => {
  const old = execFileSync('git', ['show', 'HEAD:pages/api/records.js'], { encoding: 'utf8' });
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
