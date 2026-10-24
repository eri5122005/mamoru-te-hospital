// Explicit integration command, intentionally outside tests/*.test.mjs:
// node --test tests/build/firebaseServerBoundary.build.mjs
// No Firebase SDK, network calls, production pages, .env loading or npm commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const policyPath = join(repo, 'tests/helpers/firebaseBoundaryPolicy.cjs');
const nextCli = join(repo, 'node_modules/next/dist/bin/next');
// Allow only OS necessities; do not inherit credentials, NEXT_PUBLIC_*, NODE_OPTIONS,
// Firebase, proxy, Vercel, or application environment. Parent env is never changed.
function childEnvironment() {
  const env = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR']) {
    if (typeof process.env[key] === 'string') env[key] = process.env[key];
  }
  env.NEXT_TELEMETRY_DISABLED = '1';
  return env;
}
async function build(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextCli, 'build'], {
      cwd: root, env: childEnvironment(), shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 120000);
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, timedOut, output }); });
  });
}
async function put(root, path, content) {
  const full = join(root, path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, content);
}
async function fixture(kind) {
  const root = await mkdtemp(join(resolve(repo, '..'), 'mamoru-server-boundary-'));
  try {
    // Sibling temp project keeps its dependency link inside the Turbopack root.
    // Local installed packages only; no install or dependency resolution over network.
    await symlink(join(repo, 'node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await put(root, 'package.json', JSON.stringify({ private: true, dependencies: { next: '16.3.8', react: '^18.3.1', 'react-dom': '^18.3.1', 'server-only': '0.0.1' } }));
    await put(root, 'next.config.js', `const policy = require(${JSON.stringify(policyPath)});
const checked = policy.inspectRepository(__dirname);
if (!checked.ok) throw new Error('FIREBASE_CORE_BOUNDARY:' + checked.violations.map(v => v.code).join(','));
module.exports = { turbopack: { root: ${JSON.stringify(resolve(repo, '..'))} }, experimental: { cpus: 1 } };`);
    // Exact production entry + pure core, not a marker-only stand-in.
    for (const name of ['firebaseBootstrap.js', 'firebaseBootstrapCore.js']) {
      await put(root, 'utils/server/' + name, await readFile(join(repo, 'utils/server', name), 'utf8'));
    }
    if (kind === 'pages-browser') {
      await put(root, 'pages/index.js', `import { validateServerFirebaseConfig } from '../utils/server/firebaseBootstrap';
export default function Page() { return <p>{validateServerFirebaseConfig({mode:'disabled'}).status}</p>; }`);
    } else if (kind === 'pages-server') {
      await put(root, 'pages/index.js', `export default function Page() { return <p>boundary fixture</p>; }`);
      await put(root, 'pages/api/check.js', `import { validateServerFirebaseConfig } from '../../utils/server/firebaseBootstrap';
export default function handler(req,res) { res.status(200).json(validateServerFirebaseConfig({mode:'disabled'})); }`);
    } else if (kind === 'alias-core' || kind === 'relay-core') {
      if (kind === 'alias-core') {
        await put(root, 'jsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@internal/bootstrap': ['utils/server/firebaseBootstrapCore.js'] } } }));
        await put(root, 'pages/index.js', `import { validateServerFirebaseConfig } from '@internal/bootstrap';
export default function Page() { return <p>{validateServerFirebaseConfig({mode:'disabled'}).status}</p>; }`);
      } else {
        await put(root, 'utils/relay.js', "export { validateServerFirebaseConfig } from './server/firebaseBootstrapCore';");
        await put(root, 'pages/index.js', `import { validateServerFirebaseConfig } from '../utils/relay';
export default function Page() { return <p>{validateServerFirebaseConfig({mode:'disabled'}).status}</p>; }`);
      }
    } else {
      await put(root, 'app/layout.js', 'export default function Layout({children}) { return <html><body>{children}</body></html>; }');
      await put(root, 'app/page.js', `'use client';
import { validateServerFirebaseConfig } from '../utils/server/firebaseBootstrap';
export default function Page() { return <p>{validateServerFirebaseConfig({mode:'disabled'}).status}</p>; }`);
    }
    return await build(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}
for (const kind of ['pages-server', 'pages-browser', 'app-browser', 'alias-core', 'relay-core']) {
  test(`Next production build: ${kind}`, { timeout: 150000 }, async () => {
    const result = await fixture(kind);
    assert.equal(result.timedOut, false, 'build timed out'); assert.equal(result.signal, null, 'build interrupted');
    if (kind === 'pages-server') {
      assert.equal(result.code, 0, result.output); return;
    }
    assert.notEqual(result.code, 0, 'browser import unexpectedly built');
    if (kind === 'alias-core' || kind === 'relay-core') {
      // Our build-config preflight detects core bypass; Next's marker does not.
      assert.match(result.output, kind === 'alias-core' ? /FIREBASE_CORE_BOUNDARY:CORE_ALIAS/ : /FIREBASE_CORE_BOUNDARY:CORE_REFERENCE/);
      assert.doesNotMatch(result.output, /Module not found|Can't resolve|SyntaxError|Unexpected token/i);
      return;
    }
    assert.match(result.output, /server-only/);
    assert.match(result.output, /cannot be imported|only works in a Server Component|not supported in the pages|only be used from a Server Component/i);
    assert.doesNotMatch(result.output, /Module not found|Can't resolve|SyntaxError|Unexpected token/i);
  });
}
