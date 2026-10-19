import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('pages/api/register.js');
const handler = vm.runInNewContext(source.replace('export default ', '') + '\nhandler', {});

for (const method of ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'UNKNOWN']) {
  for (const body of [
    { staffId: 'existing', name: 'Existing', wardId: '6f' },
    { staffId: 'retired', name: 'Retired', wardId: '6f', isActive: false },
    { staffId: 'new', name: 'New', wardId: '6f' },
    undefined,
  ]) {
    test(`${method} with ${body?.staffId ?? 'no body'} is always Gone without dependencies`, () => {
      const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
      handler({ method, body }, res);
      assert.equal(res.code, 410);
      assert.equal(res.body.error, 'この登録方法は廃止されています。現在の正式な登録画面を使用してください。');
    });
  }
}
test('disabled API neither imports Firebase nor accesses requests or external storage', () => {
  assert.doesNotMatch(source, /\bimport\b|firebase|\bdb\b|setDoc|updateDoc|addDoc|deleteDoc|runTransaction|writeBatch|fetch|req\./);
  const res = { status(code) { assert.equal(code, 410); return this; }, json(value) { return value; } };
  handler(new Proxy({}, { get() { assert.fail('no request fields should be read'); } }), res);
});
test('formal registration and login paths do not call the disabled API', () => {
  for (const path of [
    'pages/first-login/index.js', 'pages/admin/staff/add.js', 'pages/api/admin/staff-add.js',
    'pages/login/index.js', 'pages/api/login.js',
  ]) assert.doesNotMatch(read(path), /["'`]\/api\/register["'`]/, path);
  assert.match(read('pages/admin/staff/add.js'), /\/api\/admin\/staff-add/);
  assert.match(read('pages/first-login/index.js'), /runTransaction/);
});
