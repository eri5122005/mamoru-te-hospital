import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isRecordOperationId, generateRecordOperationId } from '../utils/recordOperationId.js';
import {
  canonicalizeRecordRequest as canonicalize, digestCanonicalRecordRequest as digest,
  serializeCanonicalRecordRequest as serialize, isSameRecordOperation,
} from '../utils/server/recordRequestDigest.js';

const id = '01234567-89ab-4cde-8fab-0123456789ab';
const body = () => ({ staffId: '0137', weightPrev: 200, weightNow: 190, isBottleExchange: false,
  operation: 'normal', name: '職員 A', wardId: '78f', department: '7.8階', unit: 'weight', mintPoint: 1 });
const hash = request => digest(canonicalize(request));
const reject = fn => assert.throws(fn, error => error instanceof TypeError && error.message === 'INVALID_RECORD_OPERATION_REQUEST');

test('generates lowercase 36-character UUID v4 using platform crypto', () => {
  const ids = Array.from({ length: 32 }, () => generateRecordOperationId());
  assert.equal(new Set(ids).size, ids.length);
  for (const value of ids) {
    assert.equal(value.length, 36); assert.equal(value, value.toLowerCase());
    assert.equal(value[14], '4'); assert.match(value[19], /^[89ab]$/);
    assert.equal(isRecordOperationId(value), true);
  }
  assert.equal(isRecordOperationId(generateRecordOperationId({ randomUUID })), true);
});

for (const variant of ['8', '9', 'a', 'b']) test(`accepts v4 variant ${variant}`, () => {
  assert.equal(isRecordOperationId(id.slice(0, 19) + variant + id.slice(20)), true);
});
for (const value of ['', ' ', null, undefined, 123, [], {}, id.toUpperCase(), id.replace('-4cde-', '-1cde-'),
  id.slice(0, 19) + '7' + id.slice(20), id.replaceAll('-', ''), id + '\n', ' ' + id, 'x'.repeat(36)]) {
  test(`rejects noncanonical UUID ${String(value)}`, () => assert.equal(isRecordOperationId(value), false));
}
test('generation has no fallback and redacts provider failures', () => {
  for (const source of [null, {}, { randomUUID: 1 }, { randomUUID: () => 'bad' },
    { randomUUID: () => id.toUpperCase() }, { randomUUID() { throw Error('PRIVATE'); } }]) {
    assert.throws(() => generateRecordOperationId(source), /^Error: OPERATION_ID_UNAVAILABLE$/);
  }
  assert.equal(generateRecordOperationId({ randomUUID: () => id }), id);
});

test('stable fixed-order serialization, actual SHA-256 and reordered JSON inputs', () => {
  const a = canonicalize(body());
  const reversed = Object.fromEntries(Object.entries(body()).reverse());
  assert.equal(hash(body()), hash(reversed));
  assert.equal(digest(a), createHash('sha256').update(serialize(a), 'utf8').digest('hex'));
  assert.match(digest(a), /^[0-9a-f]{64}$/);
  assert.equal(digest(Object.fromEntries(Object.entries(a).reverse())), digest(a));
  assert.equal(Object.isFrozen(a), true);
});
test('numeric representations and canonical staff ID preserve semantic equality and leading zero', () => {
  assert.equal(hash(body()), hash({ ...body(), staffId: ' ０１３７ ', weightPrev: '200.00', weightNow: ' 1.90e2 ', mintPoint: '1.0' }));
  assert.equal(canonicalize({ ...body(), staffId: '０１３７' }).staffId, '0137');
  assert.notEqual(hash(body()), hash({ ...body(), staffId: '137' }));
});
test('defaults, omission, nullish values and optional amount match intended API fields', () => {
  const bare = { staffId: '0137', weightPrev: 200, weightNow: 190 };
  const omitted = canonicalize(bare);
  const explicit = canonicalize({ ...bare, operation: 'normal', isBottleExchange: false,
    name: '', department: '', wardId: '', unit: 'weight', mintPoint: 0, amount: null });
  assert.deepEqual(omitted, explicit);
  assert.equal(hash(bare), hash({ ...bare, operation: undefined, name: null, unit: null, mintPoint: null, isBottleExchange: null, amount: '' }));
  assert.equal(hash({ ...bare, amount: '20.0' }), hash({ ...bare, amount: 20 }));
  assert.notEqual(hash({ ...bare, amount: 0 }), hash(bare));
});
for (const [field, value] of [['staffId', '9815'], ['weightPrev', 201], ['weightNow', 191],
  ['isBottleExchange', true], ['operation', 'remeasure'], ['operation', 'confirm_remeasurement'],
  ['name', '別職員'], ['department', '外来'], ['wardId', 'gairai'], ['unit', 'cm'], ['mintPoint', 2], ['amount', 20]]) {
  test(`different ${field} changes digest`, () => assert.notEqual(hash(body()), hash({ ...body(), [field]: value })));
}
test('stage distinction and verbatim saved strings; no accidental trimming', () => {
  assert.notEqual(hash({ ...body(), operation: 'remeasure' }), hash({ ...body(), operation: 'confirm_remeasurement' }));
  assert.notEqual(hash(body()), hash({ ...body(), name: body().name + ' ' }));
  assert.notEqual(hash(body()), hash({ ...body(), unit: 'weight ' }));
});
test('ignores client ml/date/token/secret/operationId and never serializes the body wholesale', () => {
  const request = { ...body(), ml: 999, date: 'PRIVATE-DATE', challenge: 'PRIVATE-TOKEN',
    secret: 'PRIVATE-SECRET', operationId: id, arbitrary: { private: 'PRIVATE' } };
  Object.defineProperty(request, 'challenge', { get() { throw Error('must never read token'); } });
  const canonical = canonicalize(request);
  assert.equal(digest(canonical), hash(body()));
  assert.equal(serialize(canonical).includes('PRIVATE'), false);
  assert.deepEqual(Object.keys(canonical), ['schemaVersion', 'staffId', 'previousWeight', 'weightNow',
    'isBottleExchange', 'operation', 'name', 'department', 'wardId', 'unit', 'mintPoint', 'amount']);
});
for (const field of ['weightPrev', 'weightNow', 'mintPoint', 'amount']) {
  for (const value of [NaN, Infinity, -Infinity, true, [], {}, 'NaN', 'Infinity', ' ', '0x10']) {
    test(`invalid numeric ${field} ${String(value)}`, () => reject(() => canonicalize({ ...body(), [field]: value })));
  }
}
for (const value of [null, undefined, [], 'body', 1]) test(`invalid request object ${String(value)}`, () => reject(() => canonicalize(value)));
for (const [field, values] of [
  ['staffId', ['', ' ', 137, null, [], '/', '.', '..', 'a\u0000b']],
  ['weightPrev', [undefined, null, 44.99, 263.01]], ['weightNow', [undefined, null, 45, 263.01]],
  ['isBottleExchange', ['false', 'true', 0, 1, [], {}]],
  ['operation', [null, '', 'initial', 'confirm', 1, {}]],
  ...['name', 'department', 'wardId', 'unit'].map(field => [field, [0, false, [], {}]]),
]) for (const value of values) test(`reject invalid field ${field} ${String(value)}`, () => reject(() => canonicalize({ ...body(), [field]: value })));
test('exchange may only be normal; zero usage and decimal weights remain valid', () => {
  for (const operation of ['remeasure', 'confirm_remeasurement']) reject(() => canonicalize({ ...body(), operation, isBottleExchange: true }));
  assert.equal(canonicalize({ ...body(), weightNow: 200 }).weightNow, 200);
  assert.equal(canonicalize({ ...body(), weightNow: 190.25 }).weightNow, 190.25);
  assert.equal(canonicalize({ ...body(), isBottleExchange: true, weightNow: 200 }).isBottleExchange, true);
});
test('digest rejects tampered/noncanonical structures instead of silently dropping fields', () => {
  const c = canonicalize(body());
  for (const value of [{ ...c, schemaVersion: 2 }, { ...c, extra: 'bad' }, { ...c, staffId: '０１３７' },
    { ...c, previousWeight: '200' }, { ...c, name: null }, { ...c, weightNow: NaN }, null]) reject(() => digest(value));
  const missing = { ...c }; delete missing.amount; reject(() => digest(missing));
});
test('comparison requires matching valid ID, canonical staff ID and digest', () => {
  const completed = { operationId: id, staffId: '0137', requestDigest: hash(body()) };
  assert.equal(isSameRecordOperation(completed, { ...completed }), true);
  for (const candidate of [{ ...completed, requestDigest: hash({ ...body(), weightNow: 180 }) },
    { ...completed, operationId: randomUUID() }, { ...completed, staffId: '9815' },
    { ...completed, staffId: '０１３７' }, { ...completed, requestDigest: completed.requestDigest + '\n' },
    { ...completed, requestDigest: 'bad' }, { ...completed, operationId: 'bad' }, null]) {
    assert.equal(isSameRecordOperation(completed, candidate), false);
    assert.equal(isSameRecordOperation(candidate, completed), false);
  }
});
test('helpers contain no I/O, credentials, logging or insecure randomness', () => {
  const idSource = readFileSync(new URL('../utils/recordOperationId.js', import.meta.url), 'utf8');
  const digestSource = readFileSync(new URL('../utils/server/recordRequestDigest.js', import.meta.url), 'utf8');
  assert.doesNotMatch(idSource, /\bimport\b|Math\.random\s*\(|Date\.now\s*\(/);
  for (const source of [idSource, digestSource]) assert.doesNotMatch(source,
    /firebase|fetch\s*\(|localStorage|sessionStorage|process\.env|console\.|addDoc|setDoc|updateDoc|runTransaction|writeBatch/);
});
