import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { getRecordDate } from '../utils/getRecordDate.js';

const source = fs.readFileSync(new URL('../pages/history/index.js', import.meta.url), 'utf8');
const effectStart = source.indexOf('  useEffect(() => {');
const effectEnd = source.indexOf('  }, []);', effectStart) + '  }, []);'.length;
const effect = source.slice(effectStart, effectEnd);

test('history has no selection, deletion, write capability or legacy counters', () => {
  assert.doesNotMatch(source, /selectedRecord|setSelectedRecord|handleDelete|deleteDoc|updateDoc|setDoc|addDoc|runTransaction|writeBatch|fetch\(|mintPoint|historyCount|staff\.role|名前未登録|選択した記録を削除/);
  assert.doesNotMatch(source, /localStorage\.(setItem|removeItem)/);
  const cards = source.slice(source.indexOf('{records.map('), source.indexOf('<NavBar />'));
  assert.doesNotMatch(cards, /onClick|onKeyDown|cursor:|<button|<input/);
  assert.match(cards, /background: "#ffffff"/);
});
test('retrieval and date/usage rendering remain unchanged', () => {
  const old = execFileSync('git', ['show', 'HEAD:pages/history/index.js'], { encoding: 'utf8' });
  const oldStart = old.indexOf('  useEffect(() => {');
  const oldEnd = old.indexOf('  }, []);', oldStart) + '  }, []);'.length;
  assert.equal(effect, old.slice(oldStart, oldEnd));
  const display = '{item.date ? item.date.toLocaleString("ja-JP") : "日付不明"} / {Number(item.ml).toFixed(2)} mL';
  assert.equal(source.includes(display), true);
  assert.equal(old.includes(display), true);
  assert.match(source, /href="\/mypage"/);
  assert.match(source, /<NavBar \/>/);
});
for (const role of ['staff', 'admin', 'super']) {
  test(`history loads only current staff records, sorted newest first, role=${role}`, async () => {
    const rows = [
      { staffId: '0137', ml: 0, date: '2026-10-17T00:00:00Z' },
      { staffId: 'other', ml: 999, date: '2026-10-19T00:00:00Z' },
      { staffId: '0137', ml: 10.5, date: { toDate: () => new Date('2026-10-18T00:00:00Z') } },
      { staffId: '0137', ml: 1, date: null },
    ];
    let result, current, finish;
    const loaded = new Promise(resolve => { finish = resolve; });
    const routes = [], queries = [];
    vm.runInNewContext(effect, {
      useEffect: callback => callback(), getRecordDate,
      localStorage: { getItem: key => { assert.equal(key, 'currentStaff'); return JSON.stringify({ staffId: '0137', name: 'Staff', role }); } },
      router: { replace: path => routes.push(path) }, setStaff: value => { current = value; },
      db: {}, collection: (_, name) => name, where: (...args) => args,
      query: (collection, condition) => { queries.push([collection, condition]); return { collection, condition }; },
      getDocs: ({ collection, condition }) => {
        assert.equal(collection, 'records');
        return Promise.resolve({ docs: rows.filter(row => row[condition[0]] === condition[2]).map((row, i) => ({ id: String(i), data: () => row })) });
      },
      setRecords: value => { result = value; finish(); },
    });
    await loaded;
    assert.deepEqual(queries, [['records', ['staffId', '==', '0137']]]);
    assert.equal(current.staffId, '0137');
    assert.deepEqual(Array.from(result, row => row.ml), [10.5, 0, 1]);
    assert.equal(result[0].date.toISOString(), '2026-10-18T00:00:00.000Z');
    assert.equal(result[2].date, null);
    assert.deepEqual(routes, []);
  });
}
test('missing currentStaff retains login redirect and does not query Firestore', () => {
  const routes = [];
  vm.runInNewContext(effect, {
    useEffect: callback => callback(), localStorage: { getItem: () => null },
    router: { replace: route => routes.push(route) },
    getDocs() { assert.fail('must not query'); },
  });
  assert.deepEqual(routes, ['/login']);
});
