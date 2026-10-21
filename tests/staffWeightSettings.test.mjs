import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';
import { isActiveStaff } from '../utils/isActiveStaff.js';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const strip = text => text.replace(/^import .*;\n/gm, '').replaceAll('export ', '').replace('default function', 'function');
const server = strip(read('utils/handleStaffWeightSettings.js'));
const request = strip(read('utils/requestStaffWeightSettings.js'));
const firstPage = read('pages/first-weight.js');
const modePage = read('pages/change-mode.js');
const initial = { 'staff/0137': { name: 'Staff', mode: 'weight', lastWeight: null, emptyWeight: null } };
function database(data = initial, fail = false, retire = false) {
  const docs = new Map(Object.entries(structuredClone(data)));
  const commits = [], reads = [];
  let version = 0;
  const snap = key => ({ exists: () => docs.has(key), data: () => structuredClone(docs.get(key)) });
  return { docs, commits, reads, getDoc: async ref => { reads.push(ref); return snap(ref); },
    async runTransaction(_, callback) {
      for (;;) {
        const before = version;
        const pending = [];
        const result = await callback({
          get: async ref => { assert.equal(pending.length, 0); reads.push(ref); return snap(ref); },
          update: (ref, fields) => pending.push([ref, fields]),
        });
        if (retire && pending.length) {
          docs.set('staff/0137', { ...docs.get('staff/0137'), isActive: false });
          version++; retire = false;
        }
        if (before !== version) continue;
        if (fail && pending.length) throw new Error('commit failure');
        const next = new Map(docs);
        for (const [key, value] of pending) {
          assert.equal(next.has(key), true, 'never create a missing document');
          next.set(key, { ...next.get(key), ...JSON.parse(JSON.stringify(value)) });
        }
        if (pending.length) { docs.clear(); for (const [k, v] of next) docs.set(k, v); version++; commits.push(pending); }
        return result;
      }
    },
  };
}
async function api(kind, body = { staffId: '0137', weight: '240', mode: 'weight' }, db = database(), method = 'POST') {
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.code = code; return this; }, json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; } };
  const route = strip(read(`pages/api/staff/${kind}.js`));
  await vm.runInNewContext(`${server}\n${route}\nhandler(req, res)`, {
    normalizeStaffId, isActiveStaff, db: {}, doc: (_, collection, id) => `${collection}/${id}`,
    getDoc: db.getDoc, getDocFromServer: db.getDocFromServer ?? db.getDoc, runTransaction: db.runTransaction, console: { error() {} },
    req: { method, body, query: body }, res,
  });
  return { res, db };
}
for (const kind of ['first-weight']) {
  for (const active of [true, undefined, null]) test(`${kind}: active ${active} succeeds`, async () => {
    const db = database({ 'staff/0137': { ...initial['staff/0137'], ...(active === undefined ? {} : { isActive: active }) } });
    const { res } = await api(kind, undefined, db);
    assert.equal(res.code, 200);
    assert.equal(db.docs.get('staff/0137').lastWeight, 240);
    assert.equal(db.docs.get('staff/0137').emptyWeight, 46);
    assert.equal(db.docs.get('staff/0137').mode, 'weight');
  });
  for (const [data, expected] of [[{ 'staff/0137': { isActive: false }, 'staffs/0137': { lastWeight: 100 } }, 403], [{}, 404]]) {
    test(`${kind}: ${expected} has zero writes`, async () => {
      const db = database(data);
      const before = JSON.stringify([...db.docs]);
      const { res } = await api(kind, undefined, db);
      assert.equal(res.code, expected);
      assert.equal(db.commits.length, 0);
      assert.equal(JSON.stringify([...db.docs]), before);
    });
  }
  for (const id of ['0137', '０１３７', ' ０１３７ ']) test(`${kind}: canonical ${id}`, async () => {
    const { db, res } = await api(kind, { staffId: id, weight: 240, mode: 'weight' });
    assert.equal(res.code, 200);
    assert.equal(res.body.staff.staffId, '0137');
    assert.equal(db.docs.has('staff/０１３７'), false);
  });
  for (const weight of ['', ' ', 0, -1, 45, 264, NaN, Infinity, [], [240], null]) test(`${kind}: invalid weight ${String(weight)}`, async () => {
    const { db, res } = await api(kind, { staffId: '0137', weight, mode: 'weight' });
    assert.equal(res.code, 400);
    assert.equal(db.commits.length, 0);
  });
  test(`${kind}: commit failure leaves both documents unchanged`, async () => {
    const db = database({ ...initial, 'staffs/0137': { lastWeight: 100 } }, true);
    const before = JSON.stringify([...db.docs]);
    const { res } = await api(kind, undefined, db);
    assert.equal(res.code, 500);
    assert.equal(JSON.stringify([...db.docs]), before);
  });
  test(`${kind}: retirement during transaction is rejected on retry`, async () => {
    const db = database(initial, false, true);
    const { res } = await api(kind, undefined, db);
    assert.equal(res.code, 403);
    assert.equal(db.docs.get('staff/0137').lastWeight, null);
    assert.equal(db.commits.length, 0);
  });
  test(`${kind}: special ID without staff document is not exempt`, async () => {
    const { res } = await api(kind, { staffId: '９９９９', weight: 240, mode: 'weight' });
    assert.equal(res.code, 404);
  });
  test(`${kind}: invalid staffId/method rejected`, async () => {
    for (const staffId of ['', ' ', [], {}, null]) assert.equal((await api(kind, { staffId, mode: 'weight', weight: 240 })).res.code, 400);
    assert.equal((await api(kind, undefined, database(), 'DELETE')).res.code, 405);
  });
}
test('first-weight syncs existing backup atomically, and never creates missing backup', async () => {
  for (const backup of [true, false]) {
    const db = database({ ...initial, ...(backup ? { 'staffs/0137': { keep: 'value' } } : {}) });
    await api('first-weight', undefined, db);
    assert.equal(db.docs.has('staffs/0137'), backup);
    assert.equal(db.commits.length, 1);
    if (backup) assert.deepEqual(db.docs.get('staffs/0137'), { keep: 'value', mode: 'weight', lastWeight: 240, emptyWeight: 46 });
  }
});
// Evaluate only the disabled route: no Firebase or shared settings helper is loaded.
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'UNKNOWN']) {
  for (const mode of ['cm', 'weight']) test(`disabled change-mode: ${method} ${mode} returns 410 without dependencies`, () => {
    const source = read('pages/api/staff/change-mode.js').replace(/\r\n/g, '\n');
    assert.doesNotMatch(source, /\bimport\b|\brequire\s*\(|handleStaffWeightSettings|firebase/);
    const handler = vm.runInNewContext(source.replace('export default function', 'function') + '\nhandler', {});
    const req = { method, body: { staffId: '0137', mode, weight: 250 }, query: { staffId: '0137' } };
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    for (let attempt = 0; attempt < 2; attempt++) {
      handler(req, res);
      assert.equal(res.code, 410);
      assert.deepEqual(JSON.parse(JSON.stringify(res.body)), {
        error: 'MODE_CHANGE_DISABLED', message: '方式変更機能は現在使用できません。',
      });
    }
  });
}
test('first-weight read checks latest status, disables caching, and never writes', async () => {
  const { res, db } = await api('first-weight', { staffId: '０１３７' }, database(), 'GET');
  assert.equal(res.code, 200);
  assert.equal(res.body.staff.staffId, '0137');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(db.commits.length, 0);
  assert.equal((await api('first-weight', { staffId: '0137' }, database({ 'staff/0137': { isActive: false } }), 'GET')).res.code, 403);
});
test('already configured first weight is never reset; concurrent initializations create only one result', async () => {
  const db = database();
  const result = await Promise.all([api('first-weight', undefined, db), api('first-weight', undefined, db)]);
  assert.deepEqual(result.map(r => r.res.code).sort(), [200, 409]);
  assert.equal(db.commits.length, 1);
});

async function screen(first, response, { network = false, quota = false, mode = 'weight' } = {}) {
  const stored = new Map([['currentStaff', JSON.stringify({ staffId: '0137', mode: 'cm', lastWeight: null })]]);
  const states = [], messages = [], routes = [], calls = [];
  const source = first ? firstPage : modePage;
  const start = source.indexOf(first ? '  const handleRegisterWeight' : '  const saveMode');
  const end = source.indexOf(first ? '\n  if (!staff)' : '\n  return (', start);
  const ref = { current: false };
  await vm.runInNewContext(`${request}\n${source.slice(start, end)}\n${first ? 'handleRegisterWeight()' : `saveMode('${mode}')`}`, {
    staff: { staffId: '0137', name: 'Staff', mode: 'cm', lastWeight: null }, weight: '240', submittingRef: ref,
    setIsSubmitting() {}, setStaff: value => states.push(value), setMessage: value => messages.push(value),
    fetch: async (url, options) => { calls.push([url, JSON.parse(options.body)]); if (network) throw new Error('network'); return response; },
    localStorage: { setItem: (key, value) => { if (quota) throw new Error('quota'); stored.set(key, value); } },
    router: { replace: route => routes.push(route) },
    setTimeout: (callback, delay) => { assert.equal(delay, 1500); callback(); },
  });
  return { stored, states, messages, routes, calls, ref };
}
const success = { ok: true, json: async () => ({ ok: true, staff: { staffId: '0137', mode: 'weight', lastWeight: 240, emptyWeight: 46 } }) };
for (const first of [true, false]) {
  test(`screen ${first ? 'first-weight' : 'change-mode'} successful state follows API response`, async () => {
    const run = await screen(first, success);
    assert.equal(run.calls.length, 1);
    assert.equal(JSON.parse(run.stored.get('currentStaff')).lastWeight, 240);
    assert.equal(run.stored.has('staff-0137'), first);
    assert.equal(run.states[0].emptyWeight, 46);
    assert.deepEqual(run.routes, ['/record']);
  });
  for (const code of [400, 403, 404, 409, 500]) test(`screen ${first}: HTTP ${code} never applies success`, async () => {
    const run = await screen(first, { ok: false, status: code, json: async () => ({ error: 'この職員番号は現在利用できません。管理者に確認してください。' }) });
    assert.equal(run.stored.size, 1);
    assert.equal(JSON.parse(run.stored.get('currentStaff')).lastWeight, null);
    assert.equal(run.states.length, 0);
    assert.deepEqual(run.routes, []);
    assert.equal(run.ref.current, false);
    assert.match(run.messages.at(-1), /管理者に確認/);
  });
  test(`screen ${first}: network, malformed response and quota errors are safe`, async () => {
    for (const [response, options] of [[success, { network: true }], [{ ok: true, json: async () => { throw new Error('JSON'); } }, {}], [success, { quota: true }]]) {
      const run = await screen(first, response, options);
      assert.equal(run.calls.length, 1);
      assert.deepEqual(run.routes, []);
      assert.match(run.messages.at(-1), /再登録せず/);
    }
  });
}
test('change-mode cm screen preserves local weights', async () => {
  const run = await screen(false, { ok: true, json: async () => ({ ok: true, staff: { staffId: '0137', mode: 'cm' } }) }, { mode: 'cm' });
  assert.equal(JSON.parse(run.stored.get('currentStaff')).lastWeight, null);
  assert.equal(run.calls[0][1].mode, 'cm');
});
test('first-weight startup never redirects a retired cached staff to record', async () => {
  const start = firstPage.indexOf('    const load = async');
  const end = firstPage.indexOf('\n    load();', start);
  const routes = [], writes = [], messages = [];
  await vm.runInNewContext(`${request}\n${firstPage.slice(start, end)}\nload()`, {
    cancelled: false, normalizeStaffId,
    localStorage: { getItem: () => JSON.stringify({ staffId: '０１３７', mode: 'weight', lastWeight: 200, emptyWeight: 46 }), setItem: (...args) => writes.push(args) },
    fetch: async url => { assert.match(url, /staffId=0137/); return { ok: false, json: async () => ({ error: '利用停止中' }) }; },
    setStaff() { assert.fail('retired staff must not become ready'); }, setMessage: m => messages.push(m), router: { replace: r => routes.push(r) },
  });
  assert.deepEqual(routes, []);
  assert.deepEqual(writes, []);
  assert.deepEqual(messages, ['利用停止中']);
});
for (const configured of [true, false]) test(`first-weight startup trusts fresh DB weights rather than cached weights: ${configured}`, async () => {
  const start = firstPage.indexOf('    const load = async');
  const end = firstPage.indexOf('\n    load();', start);
  const routes = [], writes = [], states = [];
  const latest = { staffId: '0137', mode: 'weight', ...(configured ? { lastWeight: 240, emptyWeight: 46 } : {}) };
  await vm.runInNewContext(`${request}\n${firstPage.slice(start, end)}\nload()`, {
    cancelled: false, normalizeStaffId,
    localStorage: { getItem: () => JSON.stringify({ staffId: '０１３７', mode: 'weight', lastWeight: 200, emptyWeight: 46 }), setItem: (...args) => writes.push(args) },
    fetch: async () => ({ ok: true, json: async () => ({ ok: true, staff: latest }) }),
    setStaff: value => states.push(value), setMessage() { assert.fail('unexpected error'); }, router: { replace: r => routes.push(r) },
  });
  assert.deepEqual(routes, configured ? ['/record'] : []);
  assert.equal(writes.length, configured ? 2 : 0);
  if (!configured) {
    assert.equal(states[0].lastWeight, null);
    assert.equal(states[0].emptyWeight, null);
  }
});
test('no client Firestore writes, and change-mode never adds staff cache synchronization', () => {
  for (const source of [firstPage, modePage]) assert.doesNotMatch(source, /updateDoc|setDoc|runTransaction|firebase\/firestore/);
  assert.doesNotMatch(modePage, /staffs|`staff-/);
});

test('GET never falls back to cached staff when server read fails',async()=>{
  const db=database();
  db.getDocFromServer=async()=>{throw new Error('offline');};
  const {res}=await api('first-weight',{staffId:'0137'},db,'GET');
  assert.equal(res.code,500);assert.equal(db.reads.length,0);assert.equal(db.commits.length,0);
});
