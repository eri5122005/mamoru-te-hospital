import test from 'node:test';
import assert from 'node:assert/strict';
import { getMintDateKey, getMintPoints, getMintRanking } from '../utils/getMintPoints.js';

const now = new Date('2026-10-15T00:00:00+09:00');
const record = (date = '2026-10-15T09:00:00+09:00', extra = {}) => ({ staffId: 'a', name: 'A', wardId: '4f', date, ml: 0, ...extra });

for (const count of [1, 2, 10]) {
  test(`${count} records on one day count as 1pt`, () => {
    assert.equal(getMintPoints(Array.from({ length: count }, () => record())), 1);
  });
}
test('two distinct days count as 2pt, including future dates', () => {
  assert.equal(getMintPoints([record(), record('2026-10-16T09:00:00+09:00')], 'all', now), 2);
});
test('zero usage and mixed usage are eligible', () => {
  assert.equal(getMintPoints([record()]), 1);
  assert.equal(getMintPoints([record(), record(undefined, { ml: 15 })]), 1);
});
for (const mintPoint of [1, 0, undefined, 99]) {
  test(`stored mintPoint ${mintPoint} is ignored`, () => {
    assert.equal(getMintPoints([record(undefined, { mintPoint }), record(undefined, { mintPoint })]), 1);
  });
}
test('normal and exchange records share one daily point', () => {
  assert.equal(getMintPoints([record(undefined, { isBottleExchange: false }), record(undefined, { isBottleExchange: true })]), 1);
});
test('different staff each receive 1pt on the same day', () => {
  assert.deepEqual(getMintRanking([record(), record(undefined, { staffId: 'b' })]).map(r => [r.staffId, r.mintPoint]), [['a', 1], ['b', 1]]);
});
test('JST midnight, month end, year end and leap day', () => {
  for (const [before, after, keys] of [
    ['2026-10-15T14:59:59Z', '2026-10-15T15:00:00Z', ['2026-10-15', '2026-10-16']],
    ['2026-10-31T14:59:59Z', '2026-10-31T15:00:00Z', ['2026-10-31', '2026-11-01']],
    ['2026-12-31T14:59:59Z', '2026-12-31T15:00:00Z', ['2026-12-31', '2027-01-01']],
    ['2024-02-28T14:59:59Z', '2024-02-28T15:00:00Z', ['2024-02-28', '2024-02-29']],
  ]) {
    assert.deepEqual([getMintDateKey(before), getMintDateKey(after)], keys);
    assert.equal(getMintPoints([record(before), record(after)]), 2);
  }
});
test('Date, Timestamp-like and string dates share the same key', () => {
  assert.equal(getMintPoints([record(now), record({ toDate: () => now }), record(now.toISOString())]), 1);
});
test('invalid and missing dates are skipped without throwing', () => {
  const invalid = [undefined, null, '', 'invalid', new Date(NaN), { toDate: () => { throw Error('bad'); } }];
  assert.equal(getMintPoints(invalid.map(date => ({ staffId: 'a', date }))), 0);
  assert.equal(getMintPoints([{ staffId: 'a' }]), 0);
  assert.deepEqual(getMintRanking(invalid.map(date => ({ staffId: 'a', date }))), []);
});
const records = [
  record('2025-10-15T09:00:00+09:00'),
  record('2026-09-30T23:59:59+09:00'),
  record('2026-10-01T00:00:00+09:00'),
  record('2026-10-15T00:00:00+09:00'),
  record('2026-10-15T10:00:00+09:00'),
  record('2026-10-16T00:00:00+09:00'),
];
for (const [period, expected] of [['today', 1], ['month', 3], ['year', 4], ['all', 5]]) {
  test(`${period} uses JST for both now and records`, () => {
    assert.equal(getMintPoints(records, period, now), expected);
    assert.equal(getMintRanking(records, period, now)[0].mintPoint, expected);
  });
}
test('year/month comparisons include the year at the JST new year', () => {
  const boundary = [record('2026-12-31T14:59:59Z'), record('2026-12-31T15:00:00Z')];
  for (const period of ['today', 'month', 'year']) assert.equal(getMintPoints(boundary, period, new Date('2026-12-31T15:00:00Z')), 1);
});
test('mypage total equals ranking total for each staff', () => {
  const list = [...records, record(undefined, { staffId: 'b' })];
  for (const row of getMintRanking(list)) assert.equal(row.mintPoint, getMintPoints(list.filter(r => r.staffId === row.staffId)));
});
test('deletion and usage edits follow remaining unique dates', () => {
  const list = [record(), record(), record()];
  assert.equal(getMintPoints(list.slice(1)), 1);
  assert.equal(getMintPoints([]), 0);
  assert.equal(getMintPoints(list.map(r => ({ ...r, ml: 100 }))), 1);
});
test('ranking excludes missing staff IDs and keeps descending points', () => {
  const list = [record(undefined, { staffId: 'b' }), ...records, record(undefined, { staffId: '' })];
  assert.deepEqual(getMintRanking(list).map(r => [r.staffId, r.mintPoint]), [['a', 5], ['b', 1]]);
});
test('ranking metadata comes from first eligible record; ties retain input order', () => {
  const list = [record('2025-01-01', { name: 'old' }), record(undefined, { staffId: 'b' }), record(undefined, { name: 'current' })];
  const result = getMintRanking(list, 'today', now);
  assert.deepEqual(result.map(r => [r.staffId, r.name, r.mintPoint]), [['b', 'A', 1], ['a', 'current', 1]]);
});
