import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { isActiveStaff } from '../utils/isActiveStaff.js';
import { getWorkDays } from '../utils/getWorkDays.js';
import { getRecordDate } from '../utils/getRecordDate.js';
import { isRankingUsageVisible } from '../utils/isRankingUsageVisible.js';
import { getMintRanking } from '../utils/getMintPoints.js';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const files = [
  'pages/ranking/usage.js', 'pages/ranking/count.js', 'pages/ranking/mint.js', 'pages/ranking/avg.js',
  'pages/staff/[staffId]/top5/usage.js', 'pages/staff/[staffId]/top5/avg.js',
  'pages/ranking/ward/[wardId]/index.js', 'pages/admin/global-ranking.js',
  'pages/admin/global-avg-ranking.js', 'pages/admin/ward/[wardId]/avg-ranking.js',
];
const staff = Array.from({ length: 11 }, (_, i) => ({
  staffId: `a${i}`, name: `Staff ${i}`, wardId: '6f', department: '6階', workDays: 20,
  ...(i === 1 ? {} : { isActive: i === 2 ? null : true }),
}));
staff.unshift({ staffId: 'retired', name: 'Retired', wardId: '6f', workDays: 20, isActive: false });
const date = Object.freeze({ toDate: () => new Date('2026-10-18T12:00:00+09:00') });
const records = staff.map((s, i) => Object.freeze({ ...s, ml: s.staffId === 'retired' ? 10000 : 120 - i, date, mintPoint: 99 }));
records.push(Object.freeze({ staffId: 'unknown', name: 'Unknown', wardId: '6f', ml: 9000, date }));
for (const s of staff) Object.freeze(s);
Object.freeze(staff);
Object.freeze(records);
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-18T12:00:00+09:00'])); }
  static [Symbol.hasInstance](value) { return value instanceof Date; }
}

function mocks(staffData, recordData) {
  return {
    collection: (_, name) => ({ name, conditions: [] }),
    where: (field, op, value) => ({ field, op, value }),
    query: (collection, ...conditions) => ({ ...collection, conditions }),
    getDocs: async ({ name, conditions }) => {
      const data = name === 'staff' ? staffData : recordData;
      const docs = data.filter(row => conditions.every(c => c.op !== '==' || row[c.field] === c.value))
        .map((row, index) => ({ id: `different-document-${index}`, data: () => row }));
      return { docs, forEach: callback => docs.forEach(callback) };
    },
  };
}
async function load(file, staffData = staff, recordData = records, source = read(file)) {
  const start = source.indexOf('    const load = async () => {');
  const end = source.indexOf('\n    load();', start);
  assert.ok(start >= 0 && end > start, file);
  let ranking;
  await vm.runInNewContext(`${source.slice(start, end)}\nload()`, {
    ...mocks(staffData, recordData), db: {}, Date: Clock, isActiveStaff, getWorkDays,
    getRecordDate, isRankingUsageVisible, getMintRanking,
    localStorage: { getItem: () => JSON.stringify({ wardId: '6f' }) },
    wardId: '6f', staffId: 'a0', period: 'all', mode: 'month', wardNameMap: { '6f': '6階', '4f': '4階' },
    setRanking: value => { ranking = value; }, setLoading() {}, setMonthLabel() {}, console,
  });
  return JSON.parse(JSON.stringify(ranking));
}

for (const file of files) {
  test(`${file}: false excluded; true, missing, null included; unknown staff excluded`, async () => {
    const ranking = await load(file);
    const ids = ranking.map(row => row.staffId);
    assert.equal(ids.includes('retired'), false);
    assert.equal(ids.includes('unknown'), false);
    for (const id of ['a0', 'a1', 'a2']) assert.equal(ids.includes(id), true);
    assert.equal(ids[0], 'a0');
    if (file.includes('/top5/')) {
      assert.equal(ids.length, 10);
      assert.equal(ids.at(-1), 'a9');
    }
  });
  test(`${file}: active-only values and ordering match previous implementation`, async () => {
    const active = staff.filter(isActiveStaff);
    const ids = new Set(active.map(s => s.staffId));
    const data = records.filter(r => ids.has(r.staffId));
    const previous = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
    assert.deepEqual(await load(file, active, data), await load(file, active, data, previous));
  });
}
for (const file of files.filter(f => f.startsWith('pages/ranking/') || f.includes('/ward/'))) {
  test(`${file}: other ward is excluded`, async () => {
    const other = { staffId: 'other', name: 'Other', wardId: '4f', isActive: true, workDays: 20 };
    const ranking = await load(file, [...staff, other], [...records, { ...other, ml: 20000, date }]);
    assert.equal(ranking.some(row => row.staffId === 'other'), false);
  });
}
test('mint keeps zero usage and one point per JST day regardless of stored mintPoint', async () => {
  const data = [
    { staffId: 'a0', wardId: '6f', name: 'Staff 0', ml: 0, mintPoint: 0, date },
    { staffId: 'a0', wardId: '6f', name: 'Staff 0', ml: 10, mintPoint: 99, date },
  ];
  const ranking = await load('pages/ranking/mint.js', staff, data);
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].mintPoint, 1);
});
test('records remain unchanged, including retired historical usage', async () => {
  const before = JSON.stringify(records);
  const hospitalTotal = records.reduce((sum, r) => sum + r.ml, 0);
  for (const file of files) await load(file);
  assert.equal(JSON.stringify(records), before);
  assert.equal(records.reduce((sum, r) => sum + r.ml, 0), hospitalTotal);
  assert.equal(records.find(r => r.staffId === 'retired').ml, 10000);
});
test('today ranking API retains response format while excluding retired and unknown IDs', async () => {
  const source = read('pages/api/admin/today-ranking.js').replace(/^import .*;\n/gm, '').replace('export default ', '');
  let result;
  await vm.runInNewContext(`${source}\nhandler(req, res)`, {
    ...mocks(staff, records), db: {}, Date: Clock, isActiveStaff, isRankingUsageVisible,
    req: {}, res: { status(code) { assert.equal(code, 200); return this; }, json(body) { result = body; } },
  });
  assert.equal(result.length, 11);
  assert.equal(result[0].name, 'Staff 0');
  assert.equal(result.some(row => ['Retired', 'Unknown'].includes(row.name)), false);
  assert.deepEqual(Object.keys(result[0]).sort(), ['amount', 'name', 'time', 'wardName']);
});

for (const file of ['pages/api/admin/todayTotal.js', 'pages/api/admin/month-total.js', 'pages/api/admin/ranking-month.js']) {
  test(`${file}: unchanged aggregate includes retired historical usage`, async () => {
    const source = read(file);
    assert.equal(source, execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' }));
    const data = [
      { staffId: 'retired', wardId: '6f', ml: 500, date },
      { staffId: 'a0', wardId: '6f', ml: 30, date },
    ];
    let result;
    await vm.runInNewContext(`${source.replace(/^import .*;\n/gm, '').replace('export default ', '').replace('export const ', 'const ')}\nhandler(req, res)`, {
      ...mocks(staff, data), db: {}, Date: Clock, req: {}, console,
      res: { status(code) { assert.equal(code, 200); return this; }, json(body) { result = body; } },
    });
    assert.equal(Array.isArray(result) ? result[0].total : result.total, 530);
  });
}
