// Server-only equality digest. Not a MAC, authorization, or permission to save.
import { createHash } from 'node:crypto';
import { normalizeStaffId } from '../normalizeStaffId.js';
import { isRecordOperationId } from '../recordOperationId.js';

export const RECORD_REQUEST_SCHEMA_VERSION = 1;
const invalid = () => { throw new TypeError('INVALID_RECORD_OPERATION_REQUEST'); };
const plain = value => value !== null && typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function number(value) {
  if (typeof value !== 'number' && typeof value !== 'string') invalid();
  if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) invalid();
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) invalid();
  return Object.is(parsed, -0) ? 0 : parsed;
}
function string(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') invalid();
  return value; // API stores these strings verbatim: do not trim names/ward/unit.
}
function canonicalStaffId(value) {
  if (typeof value !== 'string') invalid();
  const id = normalizeStaffId(value);
  if (!id || /[\/\u0000-\u001f\u007f]/.test(id) || id === '.' || id === '..') invalid();
  return id;
}

/** Select only request-derived saved fields and the workflow stage. Ignore client ml/date,
 * operationId, challenge, secret and all unknown fields. No whole-body serialization.
 * Malformed legacy coercions (arrays/booleans/objects/blank numeric strings) fail closed;
 * this stricter contract is NOT connected to the existing save API in this step.
 */
export function canonicalizeRecordRequest(body) {
  if (!plain(body)) invalid();
  const previousWeight = number(body.weightPrev), weightNow = number(body.weightNow);
  if (previousWeight < 45 || previousWeight > 263 || weightNow <= 45 || weightNow > 263) invalid();
  const isBottleExchange = body.isBottleExchange ?? false;
  if (typeof isBottleExchange !== 'boolean') invalid();
  const operation = body.operation === undefined ? 'normal' : body.operation;
  if (!['normal', 'remeasure', 'confirm_remeasurement'].includes(operation) ||
      (operation !== 'normal' && isBottleExchange)) invalid();
  const amount = body.amount === undefined || body.amount === null || body.amount === '' ? null : number(body.amount);
  return Object.freeze({
    schemaVersion: RECORD_REQUEST_SCHEMA_VERSION,
    staffId: canonicalStaffId(body.staffId), previousWeight, weightNow, isBottleExchange, operation,
    name: string(body.name, ''), department: string(body.department, ''),
    wardId: string(body.wardId, ''), unit: string(body.unit, 'weight'),
    mintPoint: number(body.mintPoint ?? 0), amount,
  });
}

const KEYS = Object.freeze(['schemaVersion', 'staffId', 'previousWeight', 'weightNow', 'isBottleExchange',
  'operation', 'name', 'department', 'wardId', 'unit', 'mintPoint', 'amount']);

export function serializeCanonicalRecordRequest(value) {
  if (!plain(value) || value.schemaVersion !== RECORD_REQUEST_SCHEMA_VERSION ||
      Object.keys(value).length !== KEYS.length || KEYS.some(key => !Object.hasOwn(value, key))) invalid();
  const checked = canonicalizeRecordRequest({
    staffId: value.staffId, weightPrev: value.previousWeight, weightNow: value.weightNow,
    isBottleExchange: value.isBottleExchange, operation: value.operation,
    name: value.name, department: value.department, wardId: value.wardId,
    unit: value.unit, mintPoint: value.mintPoint, amount: value.amount,
  });
  // Require actual canonical types/defaults; reject modified or unnormalized objects.
  if (KEYS.some(key => !Object.is(value[key], checked[key]))) invalid();
  return JSON.stringify(['mamoru-te:record-request', ...KEYS.map(key => checked[key])]);
}

export function digestCanonicalRecordRequest(canonicalRequest) {
  return createHash('sha256').update(serializeCanonicalRecordRequest(canonicalRequest), 'utf8').digest('hex');
}

const validDigest = value => typeof value === 'string' && value.length === 64 && /^[0-9a-f]{64}$/.test(value);
export function isSameRecordOperation(completed, candidate) {
  if (!plain(completed) || !plain(candidate)) return false;
  if (!isRecordOperationId(completed.operationId) || !isRecordOperationId(candidate.operationId) ||
      !validDigest(completed.requestDigest) || !validDigest(candidate.requestDigest)) return false;
  try {
    if (canonicalStaffId(completed.staffId) !== completed.staffId ||
        canonicalStaffId(candidate.staffId) !== candidate.staffId) return false;
  } catch { return false; }
  return completed.operationId === candidate.operationId && completed.staffId === candidate.staffId &&
    completed.requestDigest === candidate.requestDigest;
}
