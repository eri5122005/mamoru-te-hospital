// Conservative test/build preflight, not a JavaScript or Next.js module resolver.
// Product code may reference the public entry, never the pure testable core.
const fs = require('node:fs');
const path = require('node:path');
const ENTRY = 'utils/server/firebaseBootstrap.js';
const CORE = 'utils/server/firebaseBootstrapCore.js';
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const slash = value => value.replace(/\\/g, '/');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function inspectSources({ sources, configs }) {
  const violations = [];
  for (const [filename, text] of Object.entries(sources)) {
    const normalized = path.posix.normalize(slash(filename));
    // Exact repository-relative paths only, not a basename exemption.
    if (normalized === ENTRY || normalized === CORE) continue;
    if (/firebaseBootstrapCore/i.test(text)) violations.push({ code: 'CORE_REFERENCE', path: normalized });
  }
  for (const [filename, text] of Object.entries(configs)) {
    try {
      // Strict JSON only. JSONC/extends are rejected for explicit review rather
      // than silently skipped or followed outside this controlled config scope.
      const config = JSON.parse(text);
      if (!plain(config) || Object.hasOwn(config, 'extends')) throw new Error();
      const options = config.compilerOptions ?? {};
      if (!plain(options)) throw new Error();
      const base = options.baseUrl ?? '.';
      if (typeof base !== 'string' || path.posix.isAbsolute(slash(base)) || /^[a-z]:/i.test(base)) throw new Error();
      const aliases = options.paths ?? {};
      if (!plain(aliases)) throw new Error();
      for (const targets of Object.values(aliases)) {
        if (!Array.isArray(targets) || targets.length === 0) throw new Error();
        for (const target of targets) {
          if (typeof target !== 'string' || path.posix.isAbsolute(slash(target)) || /^[a-z]:/i.test(target)) throw new Error();
          const pattern = path.posix.normalize(path.posix.join(slash(base), slash(target)));
          if (pattern === '..' || pattern.startsWith('../')) throw new Error();
          const matchesCore = new RegExp('^' + pattern.split('*').map(escape).join('.*') + '$', 'i');
          // A generic project-root '*' alias (the existing @/* -> ./*) keeps
          // the full filename in the importing source, caught by CORE_REFERENCE.
          // More specific aliases that can hide that filename are prohibited,
          // even when currently unused. This is intentionally conservative.
          if (pattern !== '*' && [CORE, CORE.slice(0, -3)].some(p => matchesCore.test(p))) {
            violations.push({ code: 'CORE_ALIAS', path: filename });
          }
        }
      }
    } catch {
      violations.push({ code: 'UNSUPPORTED_ALIAS_CONFIG', path: filename });
    }
  }
  return { ok: violations.length === 0, violations };
}
function inspectRepository(root) {
  const sources = {}, configs = {};
  function read(relative) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) return;
    for (const item of fs.readdirSync(full, { withFileTypes: true })) {
      const next = path.join(relative, item.name);
      if (item.isSymbolicLink()) throw new Error('UNSUPPORTED_PRODUCT_SYMLINK');
      if (item.isDirectory()) read(next);
      else if (/\.[cm]?[jt]sx?$/.test(item.name)) sources[slash(next)] = fs.readFileSync(path.join(root, next), 'utf8');
    }
  }
  for (const folder of ['pages', 'components', 'utils', 'app', 'src']) read(folder);
  if (fs.existsSync(path.join(root, 'firebaseConfig.js'))) sources['firebaseConfig.js'] = fs.readFileSync(path.join(root, 'firebaseConfig.js'), 'utf8');
  for (const file of ['jsconfig.json', 'tsconfig.json']) {
    if (fs.existsSync(path.join(root, file))) configs[file] = fs.readFileSync(path.join(root, file), 'utf8');
  }
  return inspectSources({ sources, configs });
}
module.exports = { inspectSources, inspectRepository };
