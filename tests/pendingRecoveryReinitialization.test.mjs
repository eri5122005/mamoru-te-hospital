import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createPendingRecordRecovery } from '../utils/recoverPendingRecordOperation.js';
import { PENDING_RECORD_OPERATION_KEY as V1, pendingRecordOperationKey, createRecordOperationLifecycle, ensureNoPendingRecordOperation } from '../utils/recordOperationClient.js';
import { clearLoginIdentity } from '../utils/clearLoginIdentity.js';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';
import { isActiveStaff } from '../utils/isActiveStaff.js';

const staffId = '123456';
const key = pendingRecordOperationKey(staffId);
const pending = { staffId, operationId: '01234567-89ab-4cde-8fab-0123456789ab', savedAt: 1 };
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const page = read('pages/record/index.js');
const startup = page.slice(page.indexOf(' useEffect(() => {\n  let cancelled'), page.indexOf('  useEffect(() => registerUpdatePreparation'));
function storage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}
function makeSession(legacy = false) {
  return storage({ [legacy ? V1 : key]: JSON.stringify(pending), draft: 'untouched-draft' });
}
const unknown = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, status: 'unknown', message: 'unknown' }) });

// Execute the real initialization effect with fresh refs/state for each mount.
// Only the staff fetch/draft loader is mocked; recovery/storage are real code.
async function mount(session, local, reply = unknown) {
  let finish, cleanup;
  const done = new Promise(resolve => { finish = resolve; });
  const lifecycle = createRecordOperationLifecycle(() => assert.fail('initialization cannot generate an operation ID'));
  const ready = { current: false }, uncertain = { current: false }, messages = [], adopted = [], inputs = [];
  let queries = 0, loads = 0;
  const context = {
    useEffect: callback => { cleanup = callback(); }, AbortController, setTimeout, clearTimeout,
    beginUpdateOperation: () => finish,
    currentRecordStaffId: source => JSON.parse(source.getItem('currentStaff') || 'null')?.staffId ?? '',
    localStorage: local, sessionStorage: session,
    pendingRecoveryRef: { current: createPendingRecordRecovery() },
    operationLifecycleRef: { current: lifecycle }, saveUncertainRef: uncertain, readyRef: ready,
    currentIdRef: { current: '' }, ensureNoPendingRecordOperation,
    fetch: async (url, options) => {
      assert.match(url, /^\/api\/records\/operation-result\?/);
      assert.equal(options.method, 'GET'); queries++;
      return reply(url, options);
    },
    loadRecordContext: async () => {
      loads++;
      return { staff: { staffId, mode: 'weight', lastWeight: 200 }, weightNow: '' };
    },
    checkAppVersion: () => assert.fail('loader mocked'), requestStaffWeightSettings: () => assert.fail('loader mocked'),
    requireAppUpdate: () => assert.fail('not a version failure'),
    setStaff: staff => adopted.push(staff), setWeightNow: value => inputs.push(value),
    setReady: value => { ready.current = value; }, setDraftNotice: () => assert.fail('no restored input'),
    setMessage: message => messages.push(message),
  };
  vm.runInNewContext(startup, context);
  await done;
  return { ready, uncertain, lifecycle, messages, adopted, inputs, queries, loads, cleanup };
}
const loginIdentity = () => storage({ currentStaff: JSON.stringify({ staffId, lastWeight: 1 }), loginUser: 'old' });

test('v1 null alone does not mean no pending: migration retains v2 and blocks a fresh mount after login', async () => {
  const session = makeSession(true), local = loginIdentity();
  const first = await mount(session, local);
  assert.equal(first.ready.current, false); assert.equal(first.lifecycle.isBlocked(), true);
  assert.equal(first.queries, 1); assert.equal(first.loads, 0);
  assert.equal(session.getItem(V1), null); assert.deepEqual(JSON.parse(session.getItem(key)), pending);
  session.removeItem(V1); // The exact reported Console action; v2 is still unresolved.
  assert.equal(session.getItem(V1), null);
  first.cleanup();
  const second = await mount(session, local);
  assert.equal(second.ready.current, false); assert.equal(second.queries, 1); assert.equal(second.loads, 0);
  assert.match(second.messages[0], /再登録せず、管理者/);
  assert.deepEqual(JSON.parse(session.getItem(key)), pending); assert.equal(session.getItem('draft'), 'untouched-draft');
  second.cleanup();
});

test('unknown stays blocked while real pending exists; deleting a TEST fixture does not auto-unblock its current screen', async () => {
  const session = makeSession(), local = loginIdentity(), raw = session.getItem(key);
  const first = await mount(session, local);
  assert.equal(first.ready.current, false); assert.equal(first.uncertain.current, true);
  assert.equal(session.getItem(key), raw);
  const repeated = await mount(session, local);
  assert.equal(repeated.ready.current, false); assert.equal(session.getItem(key), raw);
  session.removeItem(key); // Test-fixture teardown only; production never does this for unknown.
  assert.equal(first.ready.current, false); assert.equal(first.lifecycle.isBlocked(), true);
  first.cleanup(); repeated.cleanup();
});

test('fresh page initialization with genuinely absent pending does not inherit unknown or blocked refs', async () => {
  const session = makeSession(), local = loginIdentity();
  const first = await mount(session, local);
  assert.equal(first.lifecycle.isBlocked(), true);
  session.removeItem(key); first.cleanup();
  const next = await mount(session, local);
  assert.equal(next.queries, 0); assert.equal(next.loads, 1); assert.equal(next.ready.current, true);
  assert.equal(next.lifecycle.isBlocked(), false); assert.equal(next.lifecycle.current(), null);
  assert.equal(next.uncertain.current, false); assert.deepEqual(next.messages, []);
  assert.equal(next.adopted[0].lastWeight, 200); assert.deepEqual(next.inputs, ['']);
  assert.equal(session.getItem('draft'), 'untouched-draft'); next.cleanup();
});

test('same recovery checker also ignores cached unknown when the actual pending has gone', async () => {
  const session = makeSession(); let calls = 0;
  const args = { storage: session, staffId, fetchImpl: async () => { calls++; return unknown(); } };
  const recover = createPendingRecordRecovery();
  assert.equal((await recover(args)).status, 'unknown');
  session.removeItem(key);
  assert.deepEqual(await recover(args), { status: 'none' }); assert.equal(calls, 1);
});

test('real login handler then record remount proceeds normally when all TEST pending is absent', async () => {
  const session = makeSession(true), local = loginIdentity(), first = await mount(session, local);
  assert.equal(first.ready.current, false);
  session.removeItem(V1); session.removeItem(key); first.cleanup();
  clearLoginIdentity(local); // /login identity cleanup, no pending or draft manipulation.
  const page = read('pages/login/index.js');
  const handler = page.slice(page.indexOf('  const handleLogin = async () => {'), page.indexOf('\n  return ('));
  const routes = [];
  await vm.runInNewContext(handler + '\nhandleLogin()', {
    staffId, normalizeStaffId, isActiveStaff, clearLoginIdentity,
    loginBusyRef: { current: false }, loginActiveRef: { current: true }, setLoginError: () => {},
    clearRecordDraft: () => {}, sessionStorage: session, localStorage: local,
    db: {}, doc: () => 'fixture-only',
    getDoc: async () => ({ exists: () => true, data: () => ({ mode: 'weight', lastWeight: 200, emptyWeight: 45 }) }),
    router: { replace: route => routes.push(route) }, alert: () => assert.fail('valid login'), console: { error: () => assert.fail('login failure') },
  });
  assert.deepEqual(routes, ['/record']);
  const next = await mount(session, local);
  assert.equal(next.ready.current, true); assert.equal(next.queries, 0); assert.equal(next.loads, 1);
  assert.equal(next.lifecycle.current(), null); assert.equal(next.lifecycle.isBlocked(), false);
  assert.equal(session.getItem('draft'), 'untouched-draft'); next.cleanup();
});

for (const [label, reply] of [
  ['network', async () => { throw Error('offline'); }],
  ['500', async () => ({ ok: false, status: 500 })],
  ['503', async () => ({ ok: false, status: 503 })],
  ['malformed', async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })],
]) test(`${label} preserves the pending evidence through a new mount`, async () => {
  const session = makeSession(), local = loginIdentity(), raw = session.getItem(key);
  const first = await mount(session, local, reply);
  assert.equal(first.ready.current, false); assert.equal(first.loads, 0); assert.equal(session.getItem(key), raw); first.cleanup();
  const next = await mount(session, local, reply);
  assert.equal(next.ready.current, false); assert.equal(next.loads, 0); assert.equal(session.getItem(key), raw);
  assert.match(next.messages[0], /再登録せず、管理者/); next.cleanup();
});

test('wrong owner inside the current staff key stays blocked and never reaches the API', async () => {
  const session = makeSession(); session.setItem(key, JSON.stringify({ ...pending, staffId: 'other' }));
  const raw = session.getItem(key), screen = await mount(session, loginIdentity());
  assert.equal(screen.ready.current, false); assert.equal(screen.queries, 0); assert.equal(screen.loads, 0);
  assert.equal(session.getItem(key), raw); screen.cleanup();
});
