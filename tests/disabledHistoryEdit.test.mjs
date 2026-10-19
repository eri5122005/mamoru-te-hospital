import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const api = read('pages/api/records.js');
const code = api.replace(/import[\s\S]*?from\s+["'][^"']+["'];\s*/g, '').replace('export default ', '');

for (const body of [
  undefined, null, {},
  { recordId: 'active-staff-record', ml: 10 },
  { recordId: 'retired-staff-record', ml: 10 },
  { recordId: '../invalid/path', ml: -1 },
  { recordId: [], ml: 'invalid' },
  { ml: 99 },
]) test(`PATCH ${JSON.stringify(body)} always returns Gone without Firestore dependencies`, async () => {
  const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  // No Firebase objects/functions are supplied: accidental database access would fail.
  await vm.runInNewContext(`${code}\nhandler(req, res)`, { req: { method: 'PATCH', body }, res });
  assert.equal(res.code, 410);
  assert.equal(res.body.error, '履歴の編集機能は廃止されています。');
});
test('PATCH never inspects request body, record ID or staff state', async () => {
  const req = { method: 'PATCH', get body() { assert.fail('must not inspect body'); }, get query() { assert.fail('must not inspect query'); } };
  const res = { status(code) { assert.equal(code, 410); return this; }, json(value) { return value; } };
  await vm.runInNewContext(`${code}\nhandler(req, res)`, { req, res });
});
test('retired edit page is a static notice with a history link and no edit capabilities', () => {
  const page = read('pages/history/edit.js');
  assert.match(page, /履歴の編集機能は廃止されています/);
  assert.match(page, /href="\/history"/);
  assert.doesNotMatch(page, /firebase|updateDoc|setDoc|deleteDoc|fetch\(|useSearchParams|useEffect|useState|<input|<form|onSubmit|saveEdit/);
});
test('POST and GET source remain byte-for-byte unchanged; only PATCH and its import are removed', () => {
  const previous = execFileSync('git', ['show', 'HEAD:pages/api/records.js'], { encoding: 'utf8' });
  const kept = source => source.slice(source.indexOf('export default async function'), source.indexOf('  // 記録を修正'));
  assert.equal(kept(api), kept(previous));
  assert.doesNotMatch(api, /updateDoc/);
});
