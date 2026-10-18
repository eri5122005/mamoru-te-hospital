import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';

const source = fs.readFileSync(new URL('../pages/first-login/index.js', import.meta.url), 'utf8');
const effect = source.slice(source.indexOf('  useEffect(() => {'), source.indexOf('\n  const handleRegister'));
const handler = source.slice(source.indexOf('  const handleRegister'), source.indexOf('\n  return ('));

// In-memory transaction mock: retry if another call commits after our reads.
function database(initial = {}, fail = false) {
  const docs = new Map(Object.entries(initial));
  const writes = [];
  let version = 0;
  let calls = 0;
  return {
    docs, writes, get calls() { return calls; },
    async runTransaction(_, callback) {
      calls++;
      if (fail) throw new Error('transaction failed');
      for (;;) {
        const before = version;
        const pending = [];
        const result = await callback({
          get: async (ref) => ({ exists: () => docs.has(ref) }),
          set: (ref, data) => pending.push([ref, data]),
        });
        if (before !== version) continue;
        for (const [ref, data] of pending) { docs.set(ref, data); writes.push([ref, data]); }
        if (pending.length) version++;
        return result;
      }
    },
  };
}

function setup(queryId, db = database(), workDays = '20', ready = true) {
  const stored = new Map();
  const routes = [];
  const alerts = [];
  const context = {
    db: {}, runTransaction: db.runTransaction, normalizeStaffId,
    doc: (_, collection, id) => `${collection}/${id}`,
    router: { isReady: ready, query: { staffId: queryId }, replace: (route) => routes.push(route) },
    realStaffId: '', setRealStaffId: (id) => { context.realStaffId = id; },
    useEffect: (callback) => callback(),
    localStorage: { setItem: (key, value) => stored.set(key, JSON.parse(value)) },
    alert: (message) => alerts.push(message), console: { error() {} },
    lastName: ' 山田 ', firstName: ' 太郎 ', department: '4階', workDays,
  };
  vm.createContext(context);
  vm.runInContext(effect, context);
  return { context, db, stored, routes, alerts, submit: () => vm.runInContext(`${handler}\nhandleRegister()`, context) };
}

for (const [query, expected] of [['9815', '9815'], ['９８１５', '9815'], ['０１３７', '0137'], [' ９８１５ ', '9815'], [' test-4f ', 'test-4f'], ['TEST-4f', 'TEST-4f']]) {
  test(`new registration ${query} uses ${expected} everywhere`, async () => {
    const run = setup(query);
    await run.submit();
    assert.equal(run.context.realStaffId, expected);
    assert.deepEqual(run.db.writes.map(([key]) => key), [`staff/${expected}`, `staffs/${expected}`]);
    for (const [, value] of run.db.writes) {
      assert.equal(value.staffId, expected);
      assert.equal(value.name, '山田 太郎');
      assert.equal(value.workDays, 20);
      assert.equal(value.wardId, '4f');
      assert.equal(value.mode, 'weight');
      assert.equal(value.role, 'staff');
      assert.equal(value.isActive, true);
    }
    assert.equal(run.db.docs.get(`staffs/${expected}`).lastWeight, null);
    assert.equal(Object.hasOwn(run.db.docs.get(`staff/${expected}`), 'lastWeight'), false);
    assert.equal(run.stored.get('currentStaff').staffId, expected);
    assert.equal(run.stored.get(`staff-${expected}`).staffId, expected);
    assert.deepEqual(run.routes, ['/first-weight']);
  });
}
for (const query of [undefined, null, [], ['9815'], {}, '', '   ']) {
  test(`invalid query ${JSON.stringify(query)} never starts transaction`, async () => {
    const run = setup(query);
    await run.submit();
    assert.equal(run.db.calls, 0);
    assert.equal(run.stored.size, 0);
    assert.deepEqual(run.routes, []);
    assert.equal(run.alerts.length, 1);
  });
}
test('router must be ready, and query changes cannot submit stale ID', async () => {
  const run = setup('9815', database(), 20, false);
  await run.submit();
  assert.equal(run.db.calls, 0);
  const changed = setup('9815');
  changed.context.router.query.staffId = '0137';
  await changed.submit();
  assert.equal(changed.db.calls, 0);
});
for (const initial of [
  { 'staff/9815': { marker: 'original' } },
  { 'staff/9815': { marker: 'original' }, 'staffs/9815': { marker: 'backup' }, 'staff/９８１５': {}, 'staffs/９８１５': {} },
  { 'staffs/9815': { marker: 'backup' } },
]) {
  test(`existing ${Object.keys(initial)} cannot be overwritten`, async () => {
    const db = database(initial);
    const before = [...db.docs];
    const run = setup('９８１５', db);
    await run.submit();
    assert.deepEqual([...db.docs], before);
    assert.equal(db.writes.length, 0);
    assert.equal(run.stored.size, 0);
    assert.deepEqual(run.routes, initial['staff/9815'] ? ['/login'] : []);
    assert.match(run.alerts[0], initial['staff/9815'] ? /ログイン画面/ : /管理者に確認/);
  });
}
test('transaction failure never runs success handling', async () => {
  const run = setup('9815', database({}, true));
  await run.submit();
  assert.equal(run.db.writes.length, 0);
  assert.equal(run.stored.size, 0);
  assert.deepEqual(run.routes, []);
  assert.match(run.alerts[0], /再登録せず/);
});
for (const days of ['', 0, '0', -1, 1.5, '20日', NaN, Infinity]) {
  test(`invalid workDays ${String(days)} stops before transaction`, async () => {
    const run = setup('9815', database(), days);
    await run.submit();
    assert.equal(run.db.calls, 0);
    assert.match(run.alerts[0], /1以上の整数/);
  });
}
test('full-time numeric 20 remains valid', async () => {
  const run = setup('0137', database(), 20);
  await run.submit();
  assert.equal(run.stored.get('currentStaff').workDays, 20);
});
test('concurrent registrations create one pair; retry has no external side effects', async () => {
  const db = database();
  const first = setup('9815', db);
  const second = setup('９８１５', db);
  await Promise.all([first.submit(), second.submit()]);
  assert.equal(db.writes.length, 2);
  assert.equal(first.stored.size + second.stored.size, 2);
  assert.equal([...first.routes, ...second.routes].filter(route => route === '/first-weight').length, 1);
  assert.equal([...first.routes, ...second.routes].filter(route => route === '/login').length, 1);
});
