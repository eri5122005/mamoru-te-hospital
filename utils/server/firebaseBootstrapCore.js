// Node-only dependency: do not import from client pages/components or shared barrels.
// Pure/mock core for direct Node tests. Product callers must use firebaseBootstrap.js.
// Runtime checks remain defense in depth, not a substitute for the entry marker.
// No Firebase SDK import, environment lookup, credential discovery or real adapter.
import { createHash } from 'node:crypto';

const error = code => Object.freeze({ status: 'error', code });
const server = () => typeof window === 'undefined' && typeof document === 'undefined';
// Copy own data descriptor values once. Never use input property reads: a Proxy
// may report descriptors that differ from its get trap, or change on later reads.
// Reflection can execute Proxy traps; the public validator catches their errors.
function snapshot(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const allowed = ['mode', 'projectId', 'firestoreEmulatorHost', 'authEmulatorHost'];
  const copy = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    copy[key] = descriptor.value;
  }
  if (!Object.hasOwn(copy, 'mode')) return null;
  // Missing own connection fields remain absent here and fail the type/host checks
  // below; the null prototype prevents any inherited fallback.
  return Object.freeze(copy);
}
const host = value => {
  if (typeof value !== 'string') return false;
  // Explicit IPv4/hostname loopback only. IPv6, URLs and alternate IP spellings
  // are deliberately unsupported until separately integration-tested in Stage 2B-2.
  const match = /^(localhost|127\.0\.0\.1):([1-9][0-9]{0,4})$/.exec(value);
  return !!match && Number(match[2]) <= 65535;
};

/** Explicit values only: never reads or changes process.env or firebaseConfig.
 * disabled accepts no connection settings. emulator requires BOTH services.
 * This is a MAMORU-TE Emulator-only restriction, NOT a general Firebase ID validator.
 * demo-* is a synthetic namespace, not verification of an external project.
 */
export function validateServerFirebaseConfig(input) {
  if (!server()) return error('SERVER_ONLY');
  try {
    const config = snapshot(input);
    if (!config) return error('INVALID_CONFIG');
    if (config.mode !== 'disabled' && config.mode !== 'emulator') return error('INVALID_MODE');
    if (config.mode === 'disabled') {
      if (Reflect.ownKeys(config).length !== 1) return error('DISABLED_HAS_SETTINGS');
      return Object.freeze({ status: 'disabled' });
    }
    if (typeof config.projectId !== 'string' || config.projectId.length > 30 ||
        !/^demo-mamoru-te-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(config.projectId)) return error('INVALID_PROJECT_ID');
    if (!host(config.firestoreEmulatorHost)) return error('INVALID_FIRESTORE_EMULATOR_HOST');
    if (!host(config.authEmulatorHost)) return error('INVALID_AUTH_EMULATOR_HOST');
    return Object.freeze({ status: 'validated', config: Object.freeze({ mode: 'emulator', projectId: config.projectId,
      firestoreEmulatorHost: config.firestoreEmulatorHost, authEmulatorHost: config.authEmulatorHost }) });
  } catch {
    return error('INVALID_CONFIG'); // Never propagate trap messages, stacks or input.
  }
}

/** Stage 2B-1 MOCK-ONLY contract. The injected function must be a no-I/O test double;
 * it is NOT sandboxed. There is intentionally no built-in real SDK adapter or ADC.
 * Creating/importing this module does not invoke the factory. Call initialize explicitly.
 * Own one bootstrap per server process/composition root; retain it across callers.
 * Do not create one per request or assume HMR/serverless instances share memory.
 * A future real adapter must independently secure its process-wide SDK registry,
 * emulator environment and credentials; these are NOT implemented in this stage.
 */
export function createMockServerFirebaseBootstrap(initializeMock) {
  if (!server()) return error('SERVER_ONLY');
  if (typeof initializeMock !== 'function') return error('INVALID_MOCK_FACTORY');
  let fingerprint = null;
  let pending = null;
  let started = false;
  return Object.freeze({
    async initialize(input) {
      if (!server()) return error('SERVER_ONLY');
      const checked = validateServerFirebaseConfig(input);
      if (checked.status !== 'validated') return checked; // No factory/credential/network activity.
      const nextFingerprint = createHash('sha256').update(JSON.stringify(checked.config)).digest('hex');
      if (started) return nextFingerprint === fingerprint ? pending : error('CONFIG_MISMATCH');
      started = true;
      fingerprint = nextFingerprint;
      // Defer invocation until pending is installed: concurrent/re-entrant callers
      // cannot start a second initialization. Never publish a partial instance.
      pending = Promise.resolve().then(() => initializeMock(checked.config)).then(instance => {
        if (instance === null || typeof instance !== 'object' || Array.isArray(instance)) return error('INITIALIZATION_FAILED');
        return Object.freeze({ status: 'ready', instance });
      }).catch(() => error('INITIALIZATION_FAILED'));
      // Failure is sticky. No automatic retry/reset: the factory might have had
      // partial effects. Do not create a replacement bootstrap to bypass failure.
      return pending;
    },
  });
}
