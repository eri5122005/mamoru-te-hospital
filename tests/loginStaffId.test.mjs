import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';
import { isActiveStaff } from '../utils/isActiveStaff.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('pages/login/index.js');
const loginSource = page.slice(page.indexOf('  const handleLogin = async () => {'), page.indexOf('\n  return ('));
const apiSource = read('pages/api/login.js').replace(/^import .*;\n/gm, '').replace('export default ', '');

function mocks(exists = true, data = {}) {
  const reads = [];
  const stored = new Map();
  const routes = [];
  const alerts = [];
  const context = {
    normalizeStaffId, isActiveStaff, db: {}, console: { error() {} },
    alert: message => alerts.push(message),
    doc: (_, collection, id) => { reads.push([collection, id]); return id; },
    getDoc: async () => ({ exists: () => exists, data: () => data }),
    localStorage: { setItem: (key, value) => stored.set(key, JSON.parse(value)) },
    router: { replace: (url) => routes.push(url) },
  };
  return { context, reads, stored, routes, alerts };
}

async function login(staffId, exists = true, data = {}) {
  const result = mocks(exists, { mode: 'weight', lastWeight: 100, emptyWeight: 46, ...data });
  await vm.runInNewContext(`${loginSource}\nhandleLogin()`, { ...result.context, staffId });
  return result;
}

for (const [input, expected] of [['9815', '9815'], ['９８１５', '9815'], [' 9815 ', '9815'], [' ９８１５ ', '9815'], ['0137', '0137'], ['０１３７', '0137'], ['test-4f', 'test-4f'], ['TEST-4f', 'TEST-4f']]) {
  test(`page normalizes ${input}, overriding stale document staffId`, async () => {
    const { reads, stored, routes } = await login(input, true, { staffId: '古いID' });
    assert.deepEqual(reads, [['staff', expected]]);
    assert.equal(stored.get('currentStaff').staffId, expected);
    assert.equal(stored.get(`staff-${expected}`).staffId, expected);
    assert.equal(stored.size, 2);
    assert.deepEqual(routes, ['/record']);
  });
}
for (const input of ['', '   ']) {
  test(`empty page input ${JSON.stringify(input)} does nothing`, async () => {
    const { reads, stored, routes } = await login(input);
    assert.equal(reads.length + stored.size + routes.length, 0);
  });
}
test('full-width super and department admin IDs retain existing branches', async () => {
  for (const [input, expected, route, role] of [['９９９９', '9999', '/admin', 'super'], [' ２６００ ', '2600', '/admin/ward/6f', 'admin']]) {
    const { reads, stored, routes } = await login(input);
    assert.equal(reads.length, 0);
    assert.equal(stored.get('currentStaff').staffId, expected);
    assert.equal(stored.get('currentStaff').role, role);
    assert.deepEqual(routes, [route]);
  }
});
test('missing staff uses normalized, encoded query without local writes', async () => {
  for (const input of [' ９８１５ ', 'test&x=1']) {
    const { reads, stored, routes } = await login(input, false);
    const id = normalizeStaffId(input);
    assert.deepEqual(reads, [['staff', id]]);
    assert.deepEqual(routes, [`/first-login?staffId=${encodeURIComponent(id)}`]);
    assert.equal(stored.size, 0);
  }
});
test('existing first-weight route remains available', async () => {
  const { routes } = await login('９８１５', true, { lastWeight: null });
  assert.deepEqual(routes, ['/first-weight']);
});

async function api(body, exists = true, method = 'POST', data = {}) {
  const result = mocks(exists, { staffId: 'stored-ID', name: 'Staff', ...data });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await vm.runInNewContext(`${apiSource}\nhandler(req, res)`, { ...result.context, req: { method, body }, res });
  return { ...result, res };
}
for (const input of ['9815', '９８１５', ' ９８１５ ', '0137', 'test-4f']) {
  test(`API searches normalized ID ${input}, preserving response structure`, async () => {
    const { reads, res } = await api({ staffId: input });
    assert.deepEqual(reads, [['staff', normalizeStaffId(input)]]);
    assert.equal(res.code, 200);
    assert.equal(res.body.firstLogin, false);
    assert.equal(res.body.staff.staffId, 'stored-ID');
  });
}
for (const value of ['', '   ', undefined, null, [], ['9815'], {}, 9815, true]) {
  test(`API rejects empty or invalid staffId ${JSON.stringify(value)}`, async () => {
    const { reads, res } = await api({ staffId: value });
    assert.equal(res.code, 400);
    assert.equal(reads.length, 0);
  });
}
test('API handles missing body, method and unknown staff', async () => {
  assert.equal((await api(undefined)).res.code, 400);
  const get = await api({ staffId: '9815' }, true, 'GET');
  assert.equal(get.res.code, 405);
  assert.equal(get.reads.length, 0);
  const missing = await api({ staffId: '９８１５' }, false);
  assert.equal(missing.res.code, 200);
  assert.equal(missing.res.body.firstLogin, true);
  assert.deepEqual(missing.reads, [['staff', '9815']]);
});

for (const data of [{ isActive: true }, {}, { isActive: null }, { isActive: 0 }, { isActive: 'false' }]) {
  test(`page and API allow legacy active status ${JSON.stringify(data)}`, async () => {
    const run = await login('０１３７', true, data);
    assert.deepEqual(run.routes, ['/record']);
    assert.equal(run.stored.get('currentStaff').staffId, '0137');
    assert.equal(run.alerts.length, 0);
    const { res } = await api({ staffId: '０１３７' }, true, 'POST', data);
    assert.equal(res.code, 200);
    assert.equal(res.body.firstLogin, false);
  });
}
for (const input of ['9815', ' ９８１５ ', '０１３７']) {
  for (const lastWeight of [100, null]) {
    test(`retired ${input}, weight ${lastWeight}: no successful storage or navigation`, async () => {
      const run = await login(input, true, { isActive: false, lastWeight });
      assert.deepEqual(run.reads, [['staff', normalizeStaffId(input)]]);
      assert.equal(run.stored.size, 0);
      assert.deepEqual(run.routes, []);
      assert.deepEqual(run.alerts, ['この職員番号は現在利用できません。管理者に確認してください。']);
      const { reads, res } = await api({ staffId: input }, true, 'POST', { isActive: false });
      assert.deepEqual(reads, [['staff', normalizeStaffId(input)]]);
      assert.equal(res.code, 403);
      assert.equal(Object.hasOwn(res.body, 'staff'), false);
      assert.equal(Object.hasOwn(res.body, 'firstLogin'), false);
      assert.match(res.body.error, /現在利用できません/);
    });
  }
}
test('retired rejection does not overwrite or clear existing localStorage', async () => {
  for (const previousId of ['9815', 'other-active-user']) {
    const run = mocks(true, { isActive: false });
    run.stored.set('currentStaff', { staffId: previousId });
    run.stored.set('unrelated-setting', { value: 1 });
    const before = JSON.stringify([...run.stored]);
    await vm.runInNewContext(`${loginSource}\nhandleLogin()`, { ...run.context, staffId: '９８１５' });
    assert.equal(JSON.stringify([...run.stored]), before);
    assert.equal(run.alerts.length, 1);
    assert.deepEqual(run.routes, []);
  }
});
test('special admin branches do not read or inspect general staff status', async () => {
  for (const [input, route] of [['９９９９', '/admin'], ['２６００', '/admin/ward/6f']]) {
    const run = await login(input, true, { isActive: false });
    assert.equal(run.reads.length, 0);
    assert.equal(run.alerts.length, 0);
    assert.deepEqual(run.routes, [route]);
  }
});
