import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStaffId } from '../utils/normalizeStaffId.js';

const cases = [
  ['9815', '9815'],
  ['９８１５', '9815'],
  [' 9815 ', '9815'],
  [' ９８１５ ', '9815'],
  ['0137', '0137'],
  ['０１３７', '0137'],
  ['test-4f', 'test-4f'],
  [' test-4f ', 'test-4f'],
  ['TEST-4f', 'TEST-4f'],
  ['', ''],
  ['   ', ''],
  [null, ''],
  [undefined, ''],
  ['ＡＢＣａｂｃ', 'ＡＢＣａｂｃ'],
  ['①②③', '①②③'],
  ['９８ １５', '98 15'],
  ['test－４f', 'test－4f'],
  ['９９９９', '9999'],
  ['０１２３４５６７８９', '0123456789'],
  [9815, '9815'],
];

for (const [input, expected] of cases) {
  test(`${String(input)} => ${JSON.stringify(expected)}`, () => {
    const result = normalizeStaffId(input);
    assert.equal(result, expected);
    assert.equal(typeof result, 'string');
    assert.equal(normalizeStaffId(result), result, 'normalization is idempotent');
  });
}
