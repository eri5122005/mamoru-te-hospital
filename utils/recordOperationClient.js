import { generateRecordOperationId, isRecordOperationId } from './recordOperationId.js';
import { normalizeStaffId } from './normalizeStaffId.js';

// Legacy source only. New operations MUST use pendingRecordOperationKey(staffId).
export const PENDING_RECORD_OPERATION_KEY = 'mamoru-te:pending-record-operation:v1';
export const RECORD_RESULT_UNKNOWN_MESSAGE = '登録結果を確認できませんでした。再登録せず、管理者に確認してください。';
const validStaff = id => typeof id === 'string' && !!id && normalizeStaffId(id) === id &&
  !/[\/\u0000-\u001f\u007f]/.test(id) && id !== '.' && id !== '..';
const validTime = value => Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;

// In-memory only. One ID spans all remeasurement stages; it is not authentication.
export function createRecordOperationLifecycle(generate = generateRecordOperationId) {
  let current = null, blocked = false;
  const match = (staffId, operationId) => {
    if (!current || current.staffId !== staffId || current.operationId !== operationId) throw new Error('RECORD_OPERATION_MISMATCH');
  };
  return {
    begin(staffId) {
      if (blocked || !validStaff(staffId)) throw new Error('RECORD_OPERATION_BLOCKED');
      if (current) { match(staffId, current.operationId); return current.operationId; }
      const operationId = generate();
      if (!isRecordOperationId(operationId)) throw new Error('OPERATION_ID_UNAVAILABLE');
      current = { staffId, operationId, sent: false }; return operationId;
    },
    current: () => current ? Object.freeze({ ...current }) : null,
    markSent(staffId, operationId) { if (blocked) throw new Error('RECORD_OPERATION_BLOCKED'); match(staffId, operationId); current.sent = true; },
    complete(staffId, operationId) {
      if (blocked) throw new Error('RECORD_OPERATION_BLOCKED');
      match(staffId, operationId);
      if (!current.sent) throw new Error('RECORD_OPERATION_NOT_SENT');
      current = null;
    },
    cancelUnsent() { if (current?.sent || blocked) return false; current = null; return true; },
    block() { blocked = true; },
    isBlocked: () => blocked,
  };
}

// Explicit selection prevents a caller from falling back to another staff's evidence.
export function pendingRecordOperationKey(staffId) {
  if (typeof staffId !== 'string') throw new Error('INVALID_PENDING_STAFF');
  const id = normalizeStaffId(staffId);
  if (!validStaff(id)) throw new Error('INVALID_PENDING_STAFF');
  return `mamoru-te:pending-record-operation:v2:${encodeURIComponent(id)}`;
}
function parsePending(raw, now) {
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('INVALID_PENDING_RECORD_OPERATION'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'operationId,savedAt,staffId' ||
      !validStaff(value.staffId) || !isRecordOperationId(value.operationId) ||
      !validTime(value.savedAt) || value.savedAt > now) throw new Error('INVALID_PENDING_RECORD_OPERATION');
  return value;
}
const samePending = (a, b) => a.staffId === b.staffId && a.operationId === b.operationId && a.savedAt === b.savedAt;
// Preserve v1 on every failure. Writing v2 first makes crash recovery repeatable.
// Migration may move another staff's evidence, but never queries their result API.
export function migratePendingRecordOperation(storage, now = Date.now()) {
  const raw = storage.getItem(PENDING_RECORD_OPERATION_KEY);
  if (raw === null) return;
  const pending = parsePending(raw, now);
  const key = pendingRecordOperationKey(pending.staffId);
  const existing = storage.getItem(key);
  if (existing !== null && !samePending(parsePending(existing, now), pending)) throw new Error('PENDING_MIGRATION_CONFLICT');
  if (existing === null) storage.setItem(key, JSON.stringify({ staffId: pending.staffId, operationId: pending.operationId, savedAt: pending.savedAt }));
  const saved = storage.getItem(key);
  if (saved === null || !samePending(parsePending(saved, now), pending)) throw new Error('PENDING_MIGRATION_NOT_SAVED');
  if (storage.getItem(PENDING_RECORD_OPERATION_KEY) !== raw) throw new Error('PENDING_MIGRATION_CHANGED');
  storage.removeItem(PENDING_RECORD_OPERATION_KEY);
  if (storage.getItem(PENDING_RECORD_OPERATION_KEY) !== null) throw new Error('PENDING_MIGRATION_NOT_CLEARED');
}
// No TTL. A malformed legacy item blocks all users; v2 reads only the selected owner.
export function readPendingRecordOperation(storage, staffId, now = Date.now()) {
  migratePendingRecordOperation(storage, now);
  const key = pendingRecordOperationKey(staffId);
  const raw = storage.getItem(key);
  if (raw === null) return null;
  const value = parsePending(raw, now);
  if (value.staffId !== normalizeStaffId(staffId)) throw new Error('PENDING_RECORD_OPERATION_MISMATCH');
  return value;
}
export function ensureNoPendingRecordOperation(storage, staffId) {
  try { if (readPendingRecordOperation(storage, staffId) === null) return; } catch { /* Block, never erase evidence. */ }
  throw new Error(RECORD_RESULT_UNKNOWN_MESSAGE);
}
export function savePendingRecordOperation(storage, staffId, operationId, now = Date.now()) {
  if (!validStaff(staffId) || !isRecordOperationId(operationId) || !validTime(now)) throw new Error('INVALID_PENDING_RECORD_OPERATION');
  if (readPendingRecordOperation(storage, staffId, now) !== null) throw new Error('PENDING_RECORD_OPERATION_EXISTS');
  const key = pendingRecordOperationKey(staffId);
  const raw = JSON.stringify({ staffId, operationId, savedAt: now });
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new Error('PENDING_RECORD_OPERATION_NOT_SAVED');
}
export function clearPendingRecordOperation(storage, staffId, operationId) {
  const pending = readPendingRecordOperation(storage, staffId);
  if (!pending) return;
  if (pending.staffId !== staffId || pending.operationId !== operationId) throw new Error('PENDING_RECORD_OPERATION_MISMATCH');
  const key = pendingRecordOperationKey(staffId);
  storage.removeItem(key);
  if (storage.getItem(key) !== null) throw new Error('PENDING_RECORD_OPERATION_NOT_CLEARED');
}

const failureCodes = {
  400: [undefined, 'INVALID_OPERATION_REQUEST', 'OPERATION_ID_REQUIRED', 'WEIGHT_CHALLENGE_INVALID', 'WEIGHT_CHALLENGE_WRONG_STAGE'],
  403: [undefined], 404: [undefined],
  409: [undefined, 'WEIGHT_CHALLENGE_OPERATION_MISMATCH', 'WEIGHT_CHALLENGE_STAFF_MISMATCH',
    'WEIGHT_CHALLENGE_PREVIOUS_WEIGHT_MISMATCH', 'WEIGHT_CONFIRMATION_CHANGED',
    'WEIGHT_CHALLENGE_APP_VERSION_MISMATCH', 'WEIGHT_CHALLENGE_RULE_VERSION_MISMATCH', 'OPERATION_ID_REUSED_WITH_DIFFERENT_REQUEST'],
  422: ['WEIGHT_CHALLENGE_EXPIRED'], 426: ['APP_UPDATE_REQUIRED'],
  // These are explicit PRE-SAVE failures. Generic 5xx and a damaged saved receipt remain unknown.
  503: ['APP_VERSION_UNAVAILABLE', 'WEIGHT_HISTORY_LIMIT_REACHED', 'WEIGHT_HISTORY_UNAVAILABLE', 'STAFF_WEIGHT_UNAVAILABLE', 'WEIGHT_CHALLENGE_UNAVAILABLE'],
};
export function isKnownRecordFailure(status, body) {
  return Number.isInteger(status) && !!body && typeof body === 'object' && !Array.isArray(body) && (body.ok === undefined || body.ok === false) && body.status === undefined &&
    body.challenge === undefined && body.replayed === undefined &&
    !Object.hasOwn(body, 'recordId') && !Object.hasOwn(body, 'lastWeight') && !Object.hasOwn(body, 'ml') &&
    typeof body.error === 'string' && !!body.error.trim() && !!failureCodes[status]?.includes(body.code);
}
export function isValidRecordSuccess(status, body, staffId, weightNow) {
  return status === 200 && body?.ok === true && body.code === undefined &&
    Object.keys(body).length === 6 && body.status === undefined && body.challenge === undefined &&
    typeof body.recordId === 'string' && !!body.recordId && !body.recordId.includes('/') &&
    body.staffId === staffId && body.lastWeight === weightNow && Number.isFinite(body.lastWeight) &&
    Number.isFinite(body.ml) && body.ml >= 0 && typeof body.replayed === 'boolean';
}
