import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { validateServerFirebaseConfig as validate, createMockServerFirebaseBootstrap as bootstrap } from '../utils/server/firebaseBootstrap.js';

const config = () => ({ mode: 'emulator', projectId: 'demo-mamoru-te-test',
  firestoreEmulatorHost: '127.0.0.1:8080', authEmulatorHost: 'localhost:9099' });
const source = readFileSync(new URL('../utils/server/firebaseBootstrap.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function harness(extra = {}) {
  // Evaluate declarations only, with no module loader. An unexpected import fails.
  const declarations = source.replace(/^import \{ createHash \} from 'node:crypto';\n/m, '').replace(/^export /gm, '');
  assert.doesNotMatch(declarations, /^\s*import\s/m);
  const context = vm.createContext({ ...extra });
  vm.runInContext(declarations + '\n globalThis.api = { validateServerFirebaseConfig, createMockServerFirebaseBootstrap };', context);
  return context;
}
test('import declarations do not initialize, discover credentials, access env/network, or hash', () => {
  let calls = 0;
  const forbidden = () => { calls++; throw new Error('UNEXPECTED_IO'); };
  harness({ createHash: forbidden, fetch: forbidden,
    initializeApp: forbidden, credential: { applicationDefault: forbidden },
    process: new Proxy({}, { get: forbidden, set: forbidden }) });
  assert.equal(calls, 0);
  assert.deepEqual([...source.matchAll(/^import .*$/gm)].map(m => m[0]), ["import { createHash } from 'node:crypto';"]);
});
test('browser-like runtime rejects validation and factory creation before dependencies execute', () => {
  const ctx = harness({ window: {}, document: {} }); let calls = 0;
  assert.equal(ctx.api.validateServerFirebaseConfig(null).code, 'SERVER_ONLY');
  assert.equal(ctx.api.createMockServerFirebaseBootstrap(() => { calls++; }).code, 'SERVER_ONLY');
  assert.equal(calls, 0);
});
test('disabled never calls initialization, network, or credential doubles', async () => {
  let initialize = 0, network = 0, credentials = 0;
  const b = bootstrap(() => { initialize++; network++; credentials++; return {}; });
  assert.deepEqual(await b.initialize({ mode: 'disabled' }), { status: 'disabled' });
  assert.deepEqual(await b.initialize({ mode: 'disabled' }), { status: 'disabled' });
  assert.deepEqual([initialize, network, credentials], [0, 0, 0]);
});
for (const input of [undefined, null, [], '', 'invalid', 0, 1, false, true, () => {}, new Date(0)]) {
  test(`malformed top-level config ${String(input)} safely refuses`, async () => {
    let calls = 0; const b = bootstrap(() => { calls++; return {}; });
    assert.equal(validate(input).status, 'error'); assert.equal((await b.initialize(input)).status, 'error');
    assert.equal(calls, 0);
  });
  test(`malformed factory ${String(input)} refuses without fallback`, () => {
    if (typeof input !== 'function') assert.equal(bootstrap(input).code, 'INVALID_MOCK_FACTORY');
  });
}
for (const mode of [undefined, null, '', 'production', 'preview', 'validation', 'EMULATOR', 0, true]) test(`unsupported mode ${String(mode)} does not initialize`, async () => {
  let calls = 0; const b = bootstrap(() => { calls++; return {}; });
  const x = config(); x.mode = mode;
  assert.equal((await b.initialize(x)).code, 'INVALID_MODE'); assert.equal(calls, 0);
});
for (const projectId of ['demo-mamoru-te-test', 'demo-mamoru-te-a', 'demo-mamoru-te-test-2']) test(`synthetic project ${projectId} validates`, () => {
  assert.equal(validate({ ...config(), projectId }).status, 'validated');
});
for (const projectId of [undefined, null, '', {}, [], 123, 'hospital-production', 'demo-other-test', 'demo-mamoru-te-',
  'demo-mamoru-te-Test', 'demo-mamoru-te-test\n', ' demo-mamoru-te-test', 'demo-mamoru-te-a--b',
  'demo-mamoru-te-test-', 'demo-mamoru-te-' + 'a'.repeat(17)]) test(`invalid project ${String(projectId)} refuses`, async () => {
  let calls = 0; const b = bootstrap(() => { calls++; return {}; });
  assert.equal((await b.initialize({ ...config(), projectId })).code, 'INVALID_PROJECT_ID'); assert.equal(calls, 0);
});
for (const field of ['firestoreEmulatorHost', 'authEmulatorHost']) {
  for (const value of ['localhost:1', 'localhost:65535', '127.0.0.1:8080']) test(`${field} accepts ${value}`, () => {
    assert.equal(validate({ ...config(), [field]: value }).status, 'validated');
  });
  for (const value of [undefined, null, '', 8080, {}, [], 'localhost', 'localhost:0', 'localhost:65536', 'localhost:999999',
    'localhost:-1', 'localhost:1.5', 'localhost:08080', 'LOCALHOST:8080', 'localhost:8080\n', ' localhost:8080',
    'http://localhost:8080', 'https://localhost:8080', 'external.example:8080', '8.8.8.8:8080',
    '0.0.0.0:8080', '127.1:8080', '127.0.0.2:8080', 'localhost.evil:8080', 'localhost.:8080',
    'user@localhost:8080', 'localhost:8080/path', 'localhost:8080?x=1', 'localhost:8080#fragment',
    '[::1]:8080', '::1:8080']) test(`${field} refuses ${String(value)}`, async () => {
    let calls = 0; const b = bootstrap(() => { calls++; return {}; });
    assert.equal((await b.initialize({ ...config(), [field]: value })).status, 'error'); assert.equal(calls, 0);
  });
}
test('both services required; no optional fallback if one is absent', () => {
  const a = config(); delete a.authEmulatorHost;
  const f = config(); delete f.firestoreEmulatorHost;
  assert.equal(validate(a).code, 'INVALID_AUTH_EMULATOR_HOST');
  assert.equal(validate(f).code, 'INVALID_FIRESTORE_EMULATOR_HOST');
});
test('disabled refuses attached connection settings or credentials', async () => {
  let calls = 0; const b = bootstrap(() => { calls++; return {}; });
  assert.equal((await b.initialize({ ...config(), mode: 'disabled' })).code, 'DISABLED_HAS_SETTINGS');
  assert.equal((await b.initialize({ mode: 'disabled', credential: 'DO-NOT-ECHO' })).code, 'INVALID_CONFIG');
  assert.equal(calls, 0);
});
test('unknown keys, public config, symbols and getters are rejected without reading them', () => {
  for (const key of ['credential', 'secret', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'apiKey', Symbol('config')]) {
    assert.equal(validate({ ...config(), [key]: 'DO-NOT-ECHO' }).code, 'INVALID_CONFIG');
  }
  const x = config(); Object.defineProperty(x, 'projectId', { get() { throw new Error('MUST_NOT_READ'); } });
  assert.equal(validate(x).code, 'INVALID_CONFIG');
});
test('factory is invoked only on explicit initialization, with frozen selected config', async () => {
  let calls = 0; let passed; const instance = {};
  const b = bootstrap(c => { calls++; passed = c; return instance; });
  assert.equal(calls, 0); const x = config(); const before = JSON.stringify(x);
  const result = await b.initialize(x);
  assert.equal(result.status, 'ready'); assert.equal(result.instance, instance); assert.equal(calls, 1);
  assert.deepEqual(passed, x); assert.equal(Object.isFrozen(passed), true); assert.equal(JSON.stringify(x), before);
});
test('same setting and key order share singleton; concurrent calls initialize once', async () => {
  let calls = 0, finish; const instance = {};
  const b = bootstrap(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const a = b.initialize(config()); const c = b.initialize({ authEmulatorHost: 'localhost:9099',
    firestoreEmulatorHost: '127.0.0.1:8080', projectId: 'demo-mamoru-te-test', mode: 'emulator' });
  await Promise.resolve(); assert.equal(calls, 1); finish(instance);
  const [first, second] = await Promise.all([a, c]); assert.equal(first, second);
  assert.equal((await b.initialize(config())).instance, instance); assert.equal(calls, 1);
});
for (const field of ['projectId', 'firestoreEmulatorHost', 'authEmulatorHost']) test(`changed ${field} rejects before reuse`, async () => {
  let calls = 0; const b = bootstrap(() => { calls++; return {}; }); await b.initialize(config());
  const x = config(); x[field] = field === 'projectId' ? 'demo-mamoru-te-other' : 'localhost:1234';
  assert.deepEqual(await b.initialize(x), { status: 'error', code: 'CONFIG_MISMATCH' }); assert.equal(calls, 1);
});
test('different config during initialization also rejects without second invocation', async () => {
  let finish, calls = 0; const b = bootstrap(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const a = b.initialize(config()); await Promise.resolve();
  assert.equal((await b.initialize({ ...config(), projectId: 'demo-mamoru-te-other' })).code, 'CONFIG_MISMATCH');
  finish({}); await a; assert.equal(calls, 1);
});
for (const fail of ['throw', 'reject', 'null', 'undefined', 'array', 'number']) test(`failed ${fail} initialization is sticky and redacted`, async () => {
  let calls = 0; const partial = {};
  const b = bootstrap(() => { calls++; partial.started = true;
    if (fail === 'throw') throw new Error('PRIVATE-ADAPTER-DATA');
    if (fail === 'reject') return Promise.reject(new Error('PRIVATE-ADAPTER-DATA'));
    return { null: null, undefined: undefined, array: [], number: 1 }[fail];
  });
  const first = await b.initialize(config()); assert.deepEqual(first, { status: 'error', code: 'INITIALIZATION_FAILED' });
  assert.equal(await b.initialize(config()), first); assert.equal(calls, 1);
  assert.equal(JSON.stringify(first).includes('PRIVATE-ADAPTER-DATA'), false); assert.equal('instance' in first, false);
});
test('disabled after initialization does not expose or reset earlier instance', async () => {
  let calls = 0; const b = bootstrap(() => { calls++; return {}; }); const first = await b.initialize(config());
  assert.deepEqual(await b.initialize({ mode: 'disabled' }), { status: 'disabled' });
  assert.equal(await b.initialize(config()), first); assert.equal(calls, 1);
});
test('no SDK, environment, network, credentials or app imports; existing product never imports new module', () => {
  const executable = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.doesNotMatch(executable, /import\s.*(?:firebase|firebaseConfig)|import\s*\(|process\.env|console\.|fetch\s*\(|require\s*\(/);
  function files(url) {
    return readdirSync(url, { withFileTypes: true }).flatMap(e => {
      const next = new URL(e.name + (e.isDirectory() ? '/' : ''), url);
      return e.isDirectory() ? files(next) : /\.(?:js|jsx|ts|tsx)$/.test(e.name) ? [next] : [];
    });
  }
  for (const dir of ['../pages/', '../components/']) for (const file of files(new URL(dir, import.meta.url))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /firebaseBootstrap/);
  }
});

for (const field of ['mode', 'projectId', 'firestoreEmulatorHost', 'authEmulatorHost']) {
  test(`inherited ${field} is not a setting`, async () => {
    const target = config(); const inherited = target[field]; delete target[field];
    const x = Object.assign(Object.create({ [field]: inherited }), target);
    let calls = 0; const b = bootstrap(() => { calls++; return {}; });
    assert.equal(validate(x).status, 'error'); assert.equal((await b.initialize(x)).status, 'error'); assert.equal(calls, 0);
  });
  test(`even polluted Object.prototype cannot supply missing ${field}`, () => {
    // Use the VM's own realm, so no shared Node prototype is ever changed.
    const ctx = harness();
    ctx.field = field;
    vm.runInContext(`
      const good = { mode: 'emulator', projectId: 'demo-mamoru-te-test',
        firestoreEmulatorHost: 'localhost:8080', authEmulatorHost: 'localhost:9099' };
      Object.defineProperty(Object.prototype, field, { value: good[field], configurable: true });
      delete good[field];
      try { globalThis.result = api.validateServerFirebaseConfig(good); }
      finally { delete Object.prototype[field]; }
    `, ctx);
    assert.equal(ctx.result.status, 'error');
  });
  for (const accessor of ['get', 'set']) test(`own ${accessor} ${field} rejects without running accessor`, () => {
    let calls = 0; const x = config();
    Object.defineProperty(x, field, { [accessor]() { calls++; throw new Error('DO-NOT-EXPOSE'); } });
    assert.deepEqual(validate(x), { status: 'error', code: 'INVALID_CONFIG' }); assert.equal(calls, 0);
  });
}
test('null-prototype own-data settings accepted; missing fields never fall back', async () => {
  const x = Object.assign(Object.create(null), config()); let received;
  const b = bootstrap(c => { received = c; return {}; });
  assert.equal((await b.initialize(x)).status, 'ready'); assert.deepEqual(received, config());
  for (const field of Object.keys(config())) {
    const missing = Object.assign(Object.create(null), config()); delete missing[field];
    assert.equal(validate(missing).status, 'error');
  }
});
test('class instances, Date and arrays are rejected', () => {
  class Settings { constructor() { Object.assign(this, config()); } }
  for (const x of [new Settings(), Object.assign(new Date(0), config()), Object.assign([], config())]) {
    assert.equal(validate(x).status, 'error');
  }
});
for (const key of ['__proto__', 'constructor', 'prototype', Symbol('setting')]) test(`own dangerous/unknown key ${String(key)} rejects`, () => {
  const x = config(); Object.defineProperty(x, key, { value: 'SYNTHETIC-PRIVATE', enumerable: true });
  assert.equal(Object.hasOwn(x, key), true);
  assert.deepEqual(validate(x), { status: 'error', code: 'INVALID_CONFIG' });
});
for (const trap of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor']) test(`throwing Proxy ${trap} is redacted and does not initialize`, async () => {
  let calls = 0; const x = new Proxy(config(), { [trap]() { throw new Error('SYNTHETIC-PRIVATE-ERROR'); } });
  const expected = { status: 'error', code: 'INVALID_CONFIG' };
  assert.deepEqual(validate(x), expected);
  const b = bootstrap(() => { calls++; return {}; });
  const result = await b.initialize(x); assert.deepEqual(result, expected); assert.equal(calls, 0);
  assert.equal(JSON.stringify(result).includes('SYNTHETIC-PRIVATE'), false);
  assert.equal('stack' in result, false); assert.equal('message' in result, false);
});
test('revoked Proxy becomes a fixed invalid-config result, not a thrown error', async () => {
  const { proxy, revoke } = Proxy.revocable(config(), {}); revoke(); let calls = 0;
  const b = bootstrap(() => { calls++; return {}; });
  assert.deepEqual(validate(proxy), { status: 'error', code: 'INVALID_CONFIG' });
  assert.equal((await b.initialize(proxy)).code, 'INVALID_CONFIG'); assert.equal(calls, 0);
});
test('descriptor snapshot ignores Proxy get trap entirely; no post-validation substitution', async () => {
  let gets = 0; const descriptorReads = new Map(); let received;
  const x = new Proxy(config(), {
    get() { gets++; throw new Error('MUST-NOT-READ-INPUT'); },
    getOwnPropertyDescriptor(target, key) {
      descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1);
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const b = bootstrap(c => { received = c; return {}; });
  assert.equal((await b.initialize(x)).status, 'ready');
  assert.deepEqual(received, config()); assert.equal(gets, 0);
  for (const key of Object.keys(config())) assert.equal(descriptorReads.get(key), 1);
});
test('Proxy descriptor values are validated, never its apparently safe get values', async () => {
  let calls = 0, gets = 0; const target = { ...config(), firestoreEmulatorHost: 'external.example:8080' };
  const x = new Proxy(target, { get(_target, key) { gets++; return config()[key]; } });
  const b = bootstrap(() => { calls++; return {}; });
  assert.equal((await b.initialize(x)).code, 'INVALID_FIRESTORE_EMULATOR_HOST'); assert.equal(calls, 0); assert.equal(gets, 0);
});
test('changes to source after capture do not change canonical config, fingerprint or factory input', async () => {
  const target = config(); let reads = 0, received, calls = 0;
  const x = new Proxy(target, {
    getOwnPropertyDescriptor(object, key) {
      reads++;
      const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
      // Snapshot this descriptor, then alter the original. A second input read
      // would now see an unsafe value, which must never reach the factory.
      object[key] = 'UNSAFE-CHANGED';
      return descriptor;
    },
    get() { throw new Error('NO-INPUT-READS'); },
  });
  const b = bootstrap(c => { calls++; received = c; return {}; });
  const first = await b.initialize(x);
  assert.equal(first.status, 'ready'); assert.equal(reads, 4); assert.deepEqual(received, config());
  assert.equal(await b.initialize(config()), first); assert.equal(calls, 1);
});
for (const mode of [' emulator', 'emulator ', 'EMULATOR', 'Emulator', ' ', '\t\n']) test(`mode exact match ${JSON.stringify(mode)}`, () => {
  assert.equal(validate({ ...config(), mode }).status, 'error');
});
test('MAMORU-TE Emulator-only project ID accepts exactly 30 characters', () => {
  const projectId = 'demo-mamoru-te-' + 'a'.repeat(30 - 'demo-mamoru-te-'.length);
  assert.equal(projectId.length, 30); assert.equal(validate({ ...config(), projectId }).status, 'validated');
  assert.equal(validate({ ...config(), projectId: projectId + 'a' }).code, 'INVALID_PROJECT_ID');
});
for (const projectId of ['demo-mamoru-te-', 'demo-mamoru-te-A', 'demo-mamoru-te-a_b', 'demo-mamoru-te-a.b',
  'demo-mamoru-te-a/b', 'demo-mamoru-te-a b', 'demo-mamoru-te-a ', 'demo-mamoru-te-ａ', 'demо-mamoru-te-a', '']) {
  test(`Emulator-only project boundary ${JSON.stringify(projectId)}`, () => {
    assert.equal(validate({ ...config(), projectId }).status, 'error');
  });
}
for (const field of ['firestoreEmulatorHost', 'authEmulatorHost']) for (const value of [
  'localhost.evil.com:8080', '127.0.0.1.evil.com:8080', 'localhost@evil.com:8080', 'evil.com@localhost:8080',
  'localhost:8080/path', 'localhost:8080?x=1', 'localhost:8080#x', 'localhost:', 'localhost:0', 'localhost:65536',
  'localhost:+8080', 'localhost:08080', 'localhost:8e3', 'localhost: 8080', 'localhost:8080 ', ' localhost:8080',
]) test(`${field} strict whole-string boundary ${JSON.stringify(value)}`, async () => {
  let calls = 0; const b = bootstrap(() => { calls++; return {}; });
  assert.equal((await b.initialize({ ...config(), [field]: value })).status, 'error'); assert.equal(calls, 0);
});
