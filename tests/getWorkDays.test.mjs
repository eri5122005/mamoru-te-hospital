import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { getWorkDays } from '../utils/getWorkDays.js';

const valid = [[20, 20], ['20', 20], [' 20 ', 20], [1, 1], ['1', 1], [999, 999], ['999', 999]];
const invalid = ['', '   ', '20日', 0, '0', undefined, null, [], [20], NaN, Infinity, -Infinity, 10.5, '10.5', -1, '-1', {}, true, false];
for (const [index, [input, expected]] of valid.entries()) {
  test(`valid ${index}: ${JSON.stringify(input)} => ${expected}`, () => assert.equal(getWorkDays(input), expected));
}
for (const [index, input] of invalid.entries()) {
  test(`invalid ${index}: ${String(input)} => null`, () => assert.equal(getWorkDays(input), null));
}
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const summary = read('utils/getMypageMonthSummary.js');
const inputStatusSource = summary.slice(summary.indexOf('export function getMonthlyInputStatus'), summary.indexOf('\nexport function getMypageMonthSummary')).replace('export function', 'function');
for (const [days, workDays, expected] of [[10, 20, 50], [10, '20', 50], [21, 20, 100], [0, 20, 0], ...['20日', 0, null, 10.5, [20]].map(w => [10, w, null])]) {
  test(`input rate ${days}/${String(workDays)} => ${expected}`, () => {
    const result = vm.runInNewContext(`${inputStatusSource}\ngetMonthlyInputStatus(days, workDays)`, { getWorkDays, days, workDays });
    assert.equal(result.rate, expected);
    assert.equal(result.workDays, expected === null ? null : 20);
  });
}

const files = ['pages/ranking/avg.js', 'pages/staff/[staffId]/top5/avg.js', 'pages/admin/global-avg-ranking.js', 'pages/admin/ward/[wardId]/avg-ranking.js'];
// Execute each actual page's load function with read-only Firestore mocks.
async function loadRanking(path, workDays) {
  const source = read(path);
  const start = source.indexOf('    const load = async () => {');
  const end = source.indexOf('\n    load();', start);
  const staff = [
    { staffId: 'a', name: 'A', department: '4階', wardId: '4f', workDays },
    { staffId: 'b', name: 'B', department: '4階', wardId: '4f', workDays: 6 },
    { staffId: 'zero', name: 'Zero', department: '4階', wardId: '4f', workDays: 20 },
  ];
  const records = [300, 120, 0].map((ml, i) => ({ ...staff[i], ml, date: { toDate: () => new Date('2026-10-15T12:00:00+09:00') } }));
  records.push({ ...records[0], ml: 999, date: { toDate: () => new Date('2026-09-30T23:59:59.999+09:00') } });
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-18T12:00:00+09:00'])); } static [Symbol.hasInstance](v) { return v instanceof Date; } }
  let ranking;
  const context = {
    Date: Clock, getWorkDays, db: {}, wardId: "4f",
    localStorage: { getItem: () => JSON.stringify({ wardId: '4f' }) },
    collection: (_, name) => name, where: (field, op, value) => ({ field, op, value }),
    query: (collection, condition) => ({ collection, condition }),
    getDocs: async (query) => ({ docs: (typeof query === 'string' ? query : query.collection) === 'staff' ? staff.map(data => ({ data: () => data })) : records.map(data => ({ data: () => data })) }),
    setRanking: value => { ranking = value; }, setLoading: () => {}, setMonthLabel: () => {},
  };
  vm.createContext(context);
  vm.runInContext(read('utils/getRecordDate.js').replace('export function', 'function') + '\n' + read('utils/isRankingUsageVisible.js').replace('export function', 'function'), context);
  await vm.runInContext(`${source.slice(start, end)}\nload()`, context);
  return JSON.parse(JSON.stringify(ranking));
}
for (const path of files) {
  for (const value of [20, '20', ' 20 ', 10.5, '10.5', [20], '20日', 0, null]) {
    test(`${path}: workDays ${JSON.stringify(value)}`, async () => {
      const ranking = await loadRanking(path, value);
      const eligible = [20, '20', ' 20 '].includes(value);
      assert.deepEqual(ranking.map(r => r.staffId), eligible ? ['b', 'a'] : ['b']);
      assert.equal(ranking[0].avgMl, 20);
      if (eligible) { assert.equal(ranking[1].avgMl, 15); assert.equal(ranking[1].workDays, 20); assert.equal(ranking[1].name, 'A'); assert.equal(ranking[1].department, '4階'); }
    });
  }
}
