import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import boundaryPolicy from './helpers/firebaseBoundaryPolicy.cjs';
import { fileURLToPath } from 'node:url';
import * as core from '../utils/server/firebaseBootstrapCore.js';

const entry = readFileSync(new URL('../utils/server/firebaseBootstrap.js', import.meta.url), 'utf8');
test('product entry marks the boundary and re-exports only the tested core API', () => {
  assert.match(entry, /^import ['"]server-only['"];$/m);
  assert.match(entry, /export \{ validateServerFirebaseConfig, createMockServerFirebaseBootstrap \} from '\.\/firebaseBootstrapCore\.js';/);
  assert.deepEqual(Object.keys(core).sort(), ['createMockServerFirebaseBootstrap', 'validateServerFirebaseConfig']);
});
test('core is directly testable in Node without loading the poisoned entry', () => {
  assert.deepEqual(core.validateServerFirebaseConfig({ mode: 'disabled' }), { status: 'disabled' });
});
test('entry performs no initialization or environment access', () => {
  const code = entry.replace(/^\/\/.*$/gm, '').trim();
  assert.equal(code.split('\n').filter(line => line.trim()).length, 2);
  assert.doesNotMatch(code, /firebase-admin|firebaseConfig|process\.|initializeApp|fetch\(/);
});
test('product core access policy checks sources and both alias config files', () => {
  assert.deepEqual(boundaryPolicy.inspectRepository(fileURLToPath(new URL('../', import.meta.url))), { ok: true, violations: [] });
});
const inspect = (sources = {}, configs = {}) => boundaryPolicy.inspectSources({ sources, configs });
for (const file of ['pages/firebaseBootstrapCore.js', 'utils/other/firebaseBootstrap.js', 'src/internal/firebaseBootstrapCore.js']) {
  test(`same basename elsewhere does not bypass inspection: ${file}`, () => {
    const r = inspect({ [file]: "export * from '../../utils/server/firebaseBootstrapCore';" });
    assert.equal(r.ok, false); assert.equal(r.violations[0].code, 'CORE_REFERENCE');
  });
}
test('only exact normalized canonical entry/core paths are exempt', () => {
  assert.equal(inspect({ 'utils/server/./firebaseBootstrap.js': "export * from './firebaseBootstrapCore';",
    'utils\\server\\firebaseBootstrapCore.js': '// firebaseBootstrapCore internal implementation' }).ok, true);
});
for (const filename of ['jsconfig.json', 'tsconfig.json']) {
  for (const target of ['utils/server/firebaseBootstrapCore.js', './utils/server/firebaseBootstrapCore',
    'utils/server/*', 'utils/server/firebaseBoot*', 'utils\\server\\firebaseBootstrapCore.js']) {
    test(`${filename} prohibits core-reaching alias ${target}`, () => {
      const configs = { [filename]: JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@internal/bootstrap': [target] } } }) };
      const r = inspect({ 'pages/index.js': "import { x } from '@internal/bootstrap';" }, configs);
      assert.equal(r.ok, false); assert.equal(r.violations[0].code, 'CORE_ALIAS');
    });
  }
}
test('baseUrl normalization is included in alias target policy', () => {
  const r = inspect({}, { 'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: './utils', paths: { '@hidden': ['server/firebaseBootstrapCore'] } } }) });
  assert.equal(r.ok, false);
});
test('existing generic root alias and unrelated aliases remain allowed', () => {
  assert.equal(inspect({}, { 'jsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'], '@helper': ['utils/helper.js'] } } }) }).ok, true);
  assert.equal(inspect({ 'pages/index.js': "import x from '@/utils/server/firebaseBootstrapCore';" },
    { 'jsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] } } }) }).ok, false);
});
for (const statement of ["export * from '../server/firebaseBootstrapCore';",
  "export { validateServerFirebaseConfig as check } from '../server/firebaseBootstrapCore';",
  "const x = require('../server/firebaseBootstrapCore');", "const x = import('../server/firebaseBootstrapCore');"]) {
  test(`relay/direct access rejects at the internal edge: ${statement}`, () => {
    const r = inspect({ 'pages/index.js': "import { check } from '../utils/relay';", 'utils/relay.js': statement });
    assert.equal(r.ok, false); assert.equal(r.violations[0].path, 'utils/relay.js');
  });
}
for (const text of ['{ invalid', '{"extends":"./outside.json"}', '{"compilerOptions":{"paths":{"@hidden":"bad"}}}']) {
  test(`unsupported alias config fails closed: ${text}`, () => {
    assert.equal(inspect({}, { 'jsconfig.json': text }).violations[0].code, 'UNSUPPORTED_ALIAS_CONFIG');
  });
}
