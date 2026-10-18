import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { isActiveStaff } from '../utils/isActiveStaff.js';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
for (const [input, expected] of [
  [{ isActive: true }, true], [{ isActive: false }, false], [{}, true],
  [{ isActive: null }, true], [{ isActive: 0 }, true], [{ isActive: 'false' }, true],
  [undefined, true], [null, true],
]) test(`isActiveStaff ${JSON.stringify(input)} => ${expected}`, () => assert.equal(isActiveStaff(input), expected));

const staff = [
  { staffId: 'a', wardId: '6f', isActive: true },
  { staffId: 'b', wardId: '6f' },
  { staffId: 'c', wardId: '6f', isActive: null },
  { staffId: 'retired', wardId: '6f', isActive: false },
  { staffId: 'retired-missing', wardId: '6f', isActive: false },
  { staffId: 'other', wardId: '4f', isActive: true },
];
const records = [
  { staffId: 'a', wardId: '6f', ml: 10 },
  { staffId: 'a', wardId: '6f', ml: 20 },
  { staffId: 'b', wardId: '6f', ml: 0 },
  { staffId: 'retired', wardId: '6f', ml: 500 },
  { staffId: 'unknown', wardId: '6f', ml: 100 },
  { staffId: 'other', wardId: '4f', ml: 5 },
].map(r => ({ ...r, date: { toDate: () => new Date() } }));
for (const item of [...staff, ...records]) Object.freeze(item);
Object.freeze(staff);
Object.freeze(records);

const stripImports = source => source.replace(/import[\s\S]*?from\s+["'][^"']+["'];\s*/g, '').replace('export default ', '');
function firestore(staffData = staff, recordData = records) {
  return {
    db: {}, isActiveStaff,
    collection: (_, name) => ({ name, conditions: [] }),
    where: (field, op, value) => ({ field, op, value }),
    query: (collection, ...conditions) => ({ ...collection, conditions }),
    getDocs: async ({ name, conditions }) => {
      const data = name === 'staff' ? staffData : recordData;
      const docs = data.filter(item => conditions.every(({ field, op, value }) => op !== '==' || item[field] === value))
        .map((item, i) => ({ id: `document-${i}`, data: () => item }));
      return { docs, size: docs.length, forEach: callback => docs.forEach(callback) };
    },
  };
}
async function api(file, staffData = staff, recordData = records, source = read(file)) {
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; } };
  await vm.runInNewContext(`${stripImports(source)}\nhandler(req, res)`, {
    ...firestore(staffData, recordData), req: { query: { id: '6f' } }, res,
    console: { error() {} },
  });
  assert.equal(res.code, 200, file);
  return res.body;
}

for (const file of ['pages/api/admin/not-input-today.js', 'pages/api/admin/not-input-30days.js']) {
  test(`${file}: active intersection, retired absent, missing field retained`, async () => {
    const result = await api(file);
    assert.deepEqual(result.map(s => s.staffId), ['c']);
    const empty = await api(file, staff, []);
    assert.deepEqual(empty.map(s => s.staffId), ['a', 'b', 'c', 'other']);
  });
}
test('today counts only unique active recorders', async () => {
  // Four active IDs, three recorded IDs: a, b, other. Repeated a and retired/unknown do not count.
  assert.deepEqual(await api('pages/api/admin/today-rate.js'), { rate: 75 });
  assert.deepEqual(await api('pages/api/admin/today-not-entered-count.js'), { count: 1 });
});
test('empty active population gives zero rate/count, not negative or Infinity', async () => {
  const retired = staff.filter(s => !isActiveStaff(s));
  assert.deepEqual(await api('pages/api/admin/today-rate.js', retired), { rate: 0 });
  assert.deepEqual(await api('pages/api/admin/today-not-entered-count.js', retired), { count: 0 });
});
test('ward rate counts active people instead of records', async () => {
  const result = await api('pages/api/admin/ward-rate.js');
  const ward = result.find(r => r.wardId === '6f');
  assert.equal(ward.totalCount, 3);
  assert.equal(ward.usedCount, 2);
  assert.equal(ward.rate, 67);
});
test('ward API preserves historical records and total, while exposing active participation', async () => {
  const file = 'pages/api/admin/ward.js';
  const oldSource = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
  const before = await api(file, staff, records, oldSource);
  const after = await api(file);
  assert.deepEqual(after.records, before.records);
  assert.equal(after.totalMl, before.totalMl);
  assert.equal(after.totalMl, 530);
  assert.deepEqual(after.staff.map(s => s.staffId), ['a', 'b', 'c']);
  assert.deepEqual(after.notEntered.map(s => s.staffId), ['c']);
  assert.equal(after.activeCount, 3);
  assert.equal(after.enteredCount, 2);
});
test('record inputs remain unchanged for every API', async () => {
  const before = JSON.stringify(records);
  for (const name of ['not-input-today', 'not-input-30days', 'today-not-entered-count', 'today-rate', 'ward-rate', 'ward']) await api(`pages/api/admin/${name}.js`);
  assert.equal(JSON.stringify(records), before);
});
test('Document ID mismatch is not normalized or substituted for field staffId', async () => {
  const data = [{ staffId: 'test-6f', wardId: '6f' }];
  const rec = [{ staffId: 'test-6f', wardId: '6f', ml: 0 }];
  assert.deepEqual(await api('pages/api/admin/not-input-today.js', data, rec), []);
  assert.equal((await api('pages/api/admin/ward.js', data, rec)).enteredCount, 1);
  assert.deepEqual(await api('pages/api/admin/today-rate.js', data, rec), { rate: 100 });
});
test('global staff list excludes only false without altering retirement/delete handlers', async () => {
  const file = 'pages/admin/staff/index.js';
  const source = read(file);
  const start = source.indexOf('  const loadStaff = async');
  const end = source.indexOf('\n  useEffect(', start);
  let list;
  await vm.runInNewContext(`${source.slice(start, end)}\nloadStaff()`, {
    ...firestore(), setStaffList: value => { list = value; }, console, alert() {},
  });
  assert.deepEqual(Array.from(list, s => s.staffId), ['a', 'b', 'c', 'other']);
  const previous = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
  const handlers = text => text.slice(text.indexOf('  const retireStaff'), text.indexOf('  const grouped'));
  assert.equal(handlers(source), handlers(previous));
});
for (const [file, stateSetter] of [
  ['pages/admin/ward/[wardId]/staff.js', 'setStaff'],
  ['pages/admin/ward/[wardId]/unrecorded.js', 'setUnrecorded'],
]) test(`${file} includes missing/null active flags and excludes false`, async () => {
  const source = read(file);
  const start = source.indexOf('const fetchData = async');
  const end = source.lastIndexOf('fetchData();');
  let list;
  await vm.runInNewContext(`${source.slice(start, end)}\nfetchData()`, {
    ...firestore(staff, []), wardId: '6f', setLoading() {},
    [stateSetter]: value => { list = value; },
    getMonthlyInputStatus: (_, workDays) => ({ rate: null, workDays }),
    fetch: async () => ({ json: async () => ({ total: 0, recordDayCount: 0 }) }),
  });
  assert.deepEqual(Array.from(list, s => s.staffId), ['a', 'b', 'c']);
});
test('ward input rate screen uses active unique counts and preserves total display', () => {
  const source = read('pages/admin/ward-rate.js');
  const fragment = source.slice(source.indexOf('  const totalStaff ='), source.indexOf('\n  return ('));
  const rate = vm.runInNewContext(`${fragment}\ntodayRate`, { data: { activeCount: 3, enteredCount: 2, records: Array(10), totalMl: 530 } });
  assert.equal(rate, 67);
  assert.match(source, /data\.totalMl/);
});
