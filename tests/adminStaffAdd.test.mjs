import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';
import { getWorkDays } from '../utils/getWorkDays.js';
import { clearLoginIdentity } from '../utils/clearLoginIdentity.js';
import { isActiveStaff } from '../utils/isActiveStaff.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const strip = (source) => source.replace(/^import .*;\n/gm, '').replaceAll('export ', '');
const validation = strip(read('utils/adminStaffRegistration.js'));
const apiSource = strip(read('pages/api/admin/staff-add.js')).replace('default async function', 'async function');
const page = read('pages/admin/staff/add.js');
const submit = page.slice(page.indexOf('  const handleSubmit'), page.indexOf('\n  return ('));
const valid = { staffId: '9815', name: ' 山田 太郎 ', wardId: '6f', workDays: 20 };

function database(initial = {}, fail = false) {
  const docs = new Map(Object.entries(initial));
  const writes = [];
  let version = 0;
  let calls = 0;
  return { docs, writes, get calls() { return calls; },
    async runTransaction(_, callback) {
      calls++;
      if (fail) throw new Error('transaction failed');
      for (;;) {
        const before = version;
        const pending = [];
        const result = await callback({ get: async (key) => ({ exists: () => docs.has(key) }), set: (key, value) => pending.push([key, value]) });
        if (before !== version) continue;
        for (const [key, value] of pending) { docs.set(key, value); writes.push([key, value]); }
        if (pending.length) version++;
        return result;
      }
    },
  };
}
async function api(body = valid, db = database(), method = 'POST') {
  const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  await vm.runInNewContext(`${validation}\n${apiSource}\nhandler(req, res)`, {
    normalizeStaffId, getWorkDays, db: {}, runTransaction: db.runTransaction,
    doc: (_, collection, id) => `${collection}/${id}`, req: { body, method }, res, console: { error() {} },
  });
  return { res, db };
}
for (const id of ['9815', '９８１５', ' ９８１５ ', '0137', '０１３７', 'test-4f', 'TEST-4f']) {
  test(`API creates both documents for ${id}`, async () => {
    const { res, db } = await api({ ...valid, staffId: id });
    const normalized = normalizeStaffId(id);
    assert.equal(res.code, 200);
    assert.equal(res.body.ok, true);
    assert.deepEqual(db.writes.map(([key]) => key), [`staff/${normalized}`, `staffs/${normalized}`]);
    for (const [, data] of db.writes) assert.deepEqual(JSON.parse(JSON.stringify(data)), {
      staffId: normalized, name: '山田 太郎', wardId: '6f', department: '6階', workDays: 20,
      role: 'staff', isActive: true, mode: 'weight', lastWeight: null, emptyWeight: null,
    });
  });
}
for (const [field, values] of Object.entries({
  staffId: ['', '   ', [], ['9815'], {}, 9815, null, undefined, 'a/b'],
  name: ['', '   ', null, [], 20],
  wardId: ['', 'unknown', 'toString', ['6f'], null, 6],
  workDays: ['', '   ', 0, '0', -1, 10.5, '10.5', '20日', null, undefined, [], [20], NaN, Infinity],
})) {
  for (const value of values) test(`API rejects ${field}: ${JSON.stringify(value)}`, async () => {
    const { res, db } = await api({ ...valid, [field]: value });
    assert.equal(res.code, 400);
    assert.equal(db.calls, 0);
    assert.equal(db.writes.length, 0);
  });
}
for (const workDays of ['20', ' 20 ', 1]) {
  test(`API normalizes valid workDays ${JSON.stringify(workDays)} to number`, async () => {
    const { res, db } = await api({ ...valid, workDays });
    assert.equal(res.code, 200);
    assert.equal(db.writes[0][1].workDays, Number(workDays));
  });
}
const departments = { '4f': '4階', '5f': '5階', '6f': '6階', '78f': '7.8階', gairai: '外来', touseki: '透析室', riha: 'リハビリ', shisetsu: '施設管理', ikyoku: '医局', nursing: '看護部' };
for (const [wardId, department] of Object.entries(departments)) test(`department ${wardId}`, async () => {
  const { res, db } = await api({ ...valid, wardId });
  assert.equal(res.code, 200);
  assert.equal(db.writes[0][1].department, department);
});
test('reserved IDs exactly cover existing login administrator branches', async () => {
  const login = read('pages/login/index.js');
  const ids = [...login.slice(login.indexOf('const departmentAdmins'), login.indexOf('if (departmentAdmins')).matchAll(/"(\d+)":/g)].map(match => match[1]);
  for (const id of ['9999', ...ids, '９９９９']) {
    const { res, db } = await api({ ...valid, staffId: id });
    assert.equal(res.code, 400);
    assert.match(res.body.error, /管理者用/);
    assert.equal(db.calls, 0);
  }
});
for (const initial of [
  { 'staff/9815': { original: true } },
  { 'staffs/9815': { original: true } },
  { 'staff/9815': {}, 'staffs/9815': {}, 'staff/９８１５': {}, 'staffs/９８１５': {} },
]) test(`existing ${Object.keys(initial)} gives 409 and zero writes`, async () => {
  const db = database(initial);
  const before = JSON.stringify([...db.docs]);
  const { res } = await api({ ...valid, staffId: '９８１５' }, db);
  assert.equal(res.code, 409);
  assert.equal(db.writes.length, 0);
  assert.equal(JSON.stringify([...db.docs]), before);
});
test('concurrent API calls create one pair only', async () => {
  const db = database();
  const results = await Promise.all([api(valid, db), api({ ...valid, staffId: '９８１５' }, db)]);
  assert.deepEqual(results.map(result => result.res.code).sort(), [200, 409]);
  assert.equal(db.writes.length, 2);
});
test('transaction failure, malformed body and wrong method never succeed', async () => {
  const failed = await api(valid, database({}, true));
  assert.equal(failed.res.code, 500);
  assert.equal(failed.db.writes.length, 0);
  assert.equal((await api(null)).res.code, 400);
  const wrong = await api(valid, database(), 'GET');
  assert.equal(wrong.res.code, 405);
  assert.equal(wrong.db.calls, 0);
});

async function screen(input = valid, response = { ok: true }, throws = false) {
  const sent = [], routes = [], errors = [], states = [];
  const ref = { current: false };
  const context = { normalizeStaffId, getWorkDays, ...input,
    submittingRef: ref, setError: value => errors.push(value), setIsSubmitting: value => states.push(value),
    router: { push: value => routes.push(value) },
    localStorage: { setItem() { throw new Error('must not overwrite administrator'); } },
    event: { preventDefault() {} },
    fetch: async (url, options) => { sent.push([url, JSON.parse(options.body)]); if (throws) throw new Error('network'); return response; },
  };
  await vm.runInNewContext(`${validation}\n${submit}\nPromise.all([handleSubmit(event), handleSubmit(event)])`, context);
  return { sent, routes, errors, states, ref };
}
test('screen sends normalized data once, returns to staff list, leaves localStorage untouched', async () => {
  const run = await screen({ ...valid, staffId: ' ０１３７ ', workDays: '20' });
  assert.equal(run.sent.length, 1);
  assert.equal(run.sent[0][0], '/api/admin/staff-add');
  assert.equal(run.sent[0][1].staffId, '0137');
  assert.equal(run.sent[0][1].workDays, 20);
  assert.deepEqual(run.routes, ['/admin/staff']);
  assert.equal(run.ref.current, false);
  assert.deepEqual(run.states, [true, false]);
  assert.doesNotMatch(page, /localStorage/);
});
test('screen rejects invalid input before POST', async () => {
  const run = await screen({ ...valid, name: '   ' });
  assert.equal(run.sent.length, 0);
  assert.deepEqual(run.routes, []);
});
for (const [response, throws] of [
  [{ ok: false, json: async () => ({ error: 'この職員番号は既に登録されています。' }) }, false],
  [{ ok: false, json: async () => { throw new Error('HTML response'); } }, false],
  [{}, true],
]) test('screen failure preserves input, unlocks and does not navigate', async () => {
  const run = await screen(valid, response, throws);
  assert.deepEqual(run.routes, []);
  assert.equal(run.ref.current, false);
  assert.equal(run.errors.at(-1).length > 0, true);
});
test('created staff reaches existing first-weight branch on login', async () => {
  const { db } = await api();
  const data = db.docs.get('staff/9815');
  const page = read('pages/login/index.js');
  const handler = page.slice(page.indexOf('  const handleLogin'), page.indexOf('\n  return ('));
  const routes = [];
  await vm.runInNewContext(`${handler}\nhandleLogin()`, {
    staffId: '９８１５', normalizeStaffId, isActiveStaff, clearLoginIdentity, loginBusyRef:{current:false},loginActiveRef:{current:true},setLoginError(){}, db: {}, doc: () => 'staff/9815',
    getDoc: async () => ({ exists: () => true, data: () => data }),
    localStorage: { getItem:()=>null,removeItem(){},setItem() {} }, router: { replace: route => routes.push(route) }, console,
  });
  assert.deepEqual(routes, ['/first-weight']);
});
