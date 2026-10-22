import { normalizeStaffId } from './normalizeStaffId.js';
import { isActiveStaff } from './isActiveStaff.js';

export const LOAN_SESSION_STATES = Object.freeze({
  UNREGISTERED: 'UNREGISTERED', PENDING_APPROVAL: 'PENDING_APPROVAL', ACTIVE: 'ACTIVE',
  HANDOVER: 'HANDOVER', ADMIN_REVIEW_REQUIRED: 'ADMIN_REVIEW_REQUIRED', REVOKED: 'REVOKED', ENDED: 'ENDED',
});
const states = new Set(Object.values(LOAN_SESSION_STATES));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const time = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const optionalTime = value => value === null || time(value);
// Non-secret record identifier only: this is NOT a bearer token/entropy validator.
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 256 &&
  value.trim() === value && !/[\/\u0000-\u001f\u007f]/.test(value) && value !== '.' && value !== '..';
const staffId = value => identifier(value) && normalizeStaffId(value) === value;
function validSession(s) {
  return object(s) && identifier(s.sessionId) && staffId(s.staffId) && states.has(s.state) &&
    time(s.issuedAt) && time(s.expiresAt) && s.issuedAt < s.expiresAt &&
    optionalTime(s.revokedAt) && optionalTime(s.endedAt) &&
    (s.revokedAt === null || s.revokedAt >= s.issuedAt) && (s.endedAt === null || s.endedAt >= s.issuedAt) &&
    (s.exceptionUntil === undefined || time(s.exceptionUntil) && s.exceptionUntil > s.issuedAt && s.exceptionUntil <= s.expiresAt);
}
function snapshotReason(sessions, now, allowTemporaryExceptions) {
  if (!time(now) || typeof allowTemporaryExceptions !== 'boolean' || !Array.isArray(sessions) || !sessions.every(validSession)) return 'INVALID_INPUT';
  if (new Set(sessions.map(s => s.sessionId)).size !== sessions.length) return 'DUPLICATE_SESSION_ID';
  return null;
}
function staffReason(staff) {
  if (!object(staff) || !staffId(staff.staffId) ||
      ![undefined, null, true, false].includes(staff.isDisabled)) return 'INVALID_STAFF';
  if (!isActiveStaff(staff)) return 'STAFF_RETIRED'; // Preserve existing boolean-false-only retirement rule.
  // Stage-1 projection, not a change to the existing Firestore staff schema.
  return staff.isDisabled === true ? 'STAFF_DISABLED' : null;
}
function sessionReason(s, now, allowTemporaryExceptions) {
  if (s.state === 'REVOKED' || s.revokedAt !== null && now >= s.revokedAt) return 'SESSION_REVOKED';
  if (s.state === 'ENDED' || s.endedAt !== null && now >= s.endedAt) return 'SESSION_ENDED';
  if (now < s.issuedAt) return 'SESSION_NOT_YET_VALID';
  if (now >= s.expiresAt) return 'SESSION_EXPIRED'; // Exact expiration is invalid.
  if (s.exceptionUntil !== undefined) {
    if (!allowTemporaryExceptions) return 'EXCEPTION_NOT_ALLOWED';
    if (now >= s.exceptionUntil) return 'EXCEPTION_EXPIRED'; // Never silently promote to a normal session.
  }
  return s.state === 'ACTIVE' ? null : `SESSION_${s.state}`;
}
function uniquenessReason(sessions, id, now, allowTemporaryExceptions) {
  const active = sessions.filter(s => s.staffId === id && sessionReason(s, now, true) === null);
  const normal = active.filter(s => s.exceptionUntil === undefined);
  if (normal.length > 1 || !allowTemporaryExceptions && active.length > 1) return 'MULTIPLE_ACTIVE_SESSIONS';
  return null;
}
function pendingReason(pending) {
  if (pending === null) return null; // Explicitly confirmed absent, never undefined/read failure.
  if (!object(pending) || !['unresolved', 'succeeded', 'unknown', 'check_failed'].includes(pending.status)) return 'INVALID_PENDING';
  return pending.status === 'succeeded' ? 'PENDING_CLEANUP_REQUIRED' :
    pending.status === 'unknown' ? 'PENDING_UNKNOWN' : pending.status === 'check_failed' ? 'PENDING_CHECK_FAILED' : 'PENDING_UNRESOLVED';
}
const needsAdmin = reason => ['INVALID_INPUT', 'INVALID_STAFF', 'DUPLICATE_SESSION_ID', 'MULTIPLE_ACTIVE_SESSIONS',
  'INVALID_PENDING', 'PENDING_UNKNOWN', 'PENDING_CHECK_FAILED', 'PENDING_UNRESOLVED', 'SESSION_ADMIN_REVIEW_REQUIRED'].includes(reason);
const finished = (s, now) => s.state === 'REVOKED' || s.state === 'ENDED' ||
  s.revokedAt !== null && now >= s.revokedAt || s.endedAt !== null && now >= s.endedAt;

/** Pure snapshot policy, NOT authentication or authorization from browser claims.
 * Caller must supply trusted staff/session/exception data and a COMPLETE successful
 * session read (including expired/ended IDs for approval), not [] on read failure.
 * now is explicit epoch milliseconds. No clock, I/O, issuance, mutation or persistence.
 * No physical device identity, operation ID, token, receipt or personal name is used.
 * Decision can become stale: re-evaluate authoritative state atomically at final save.
 */
export function evaluateLoanSession({ sessionId, staff, sessions, pending, now, allowTemporaryExceptions = false } = {}) {
  let reason = snapshotReason(sessions, now, allowTemporaryExceptions) || staffReason(staff);
  const session = !reason && sessions.find(s => s.sessionId === sessionId);
  if (!reason) reason = sessionId === null ? 'UNREGISTERED' : !identifier(sessionId) ? 'INVALID_INPUT' :
    !session ? 'SESSION_NOT_FOUND' : session.staffId !== staff.staffId ? 'SESSION_STAFF_MISMATCH' :
    sessionReason(session, now, allowTemporaryExceptions) || uniquenessReason(sessions, staff.staffId, now, allowTemporaryExceptions) || pendingReason(pending);
  const canSaveRecord = !reason;
  return { state: reason === 'UNREGISTERED' ? 'UNREGISTERED' : session?.state ?? null,
    canSaveRecord, canStartNewRecord: canSaveRecord, requiresAdminReview: needsAdmin(reason) || needsAdmin(pendingReason(pending)), reason: reason ?? 'OK' };
}

/** Starting/ending a session is distinct from granting the next user access.
 * succeeded pending still requires existing H02 cleanup; pass null only after absence
 * is confirmed. No acknowledgement/escrow flag here can override unknown.
 * saveInProgress represents an authoritative in-flight save known to the caller.
 */
export function evaluateLoanSessionHandover({ sessionId, currentStaffId, sessions, pending, saveInProgress, now } = {}) {
  let reason = snapshotReason(sessions, now, false);
  if (!reason && (!staffId(currentStaffId) || typeof saveInProgress !== 'boolean' || !identifier(sessionId))) reason = 'INVALID_INPUT';
  const session = !reason && sessions.find(s => s.sessionId === sessionId);
  if (!reason) reason = !session ? 'SESSION_NOT_FOUND' : session.staffId !== currentStaffId ? 'SESSION_STAFF_MISMATCH' : null;
  const canEndSession = !reason; // Even an unknown pending must not prevent revocation.
  if (!reason) reason = (session.state === 'ADMIN_REVIEW_REQUIRED' ? 'SESSION_ADMIN_REVIEW_REQUIRED' : null) ||
    pendingReason(pending) || (saveInProgress ? 'SAVE_IN_PROGRESS' : null);
  const canStartHandover = !reason;
  if (!reason && !finished(session, now)) reason = 'SESSION_END_REQUIRED';
  return { state: needsAdmin(reason) ? 'ADMIN_REVIEW_REQUIRED' : 'HANDOVER',
    canEndSession, canStartHandover, canChangeUser: !reason, canClearLocalIdentity: !reason,
    canResolveSucceededPending: reason === 'PENDING_CLEANUP_REQUIRED', requiresAdminReview: needsAdmin(reason) || needsAdmin(pendingReason(pending)), reason: reason ?? 'OK' };
}

/** Validates a proposed PENDING_APPROVAL session, never creates/approves it.
 * previousSessionId must come from the trusted current-user assignment, not a choice
 * supplied by the browser. A brand new ID must differ from the previous/ended IDs.
 * Existing matching PENDING_APPROVAL entries are allowed, not active/ended ID reuse.
 * Exceptions are a trusted, explicitly enabled future policy; no approval UI is added.
 */
export function evaluateLoanSessionApproval({ candidate, previousSessionId, staff, sessions, pending,
  saveInProgress, now, allowTemporaryExceptions = false } = {}) {
  let reason = snapshotReason(sessions, now, allowTemporaryExceptions) || staffReason(staff);
  if (!reason && (!validSession(candidate) || candidate.state !== 'PENDING_APPROVAL' ||
      candidate.staffId !== staff.staffId || candidate.revokedAt !== null || candidate.endedAt !== null ||
      typeof saveInProgress !== 'boolean' || !(previousSessionId === null || identifier(previousSessionId)))) reason = 'INVALID_CANDIDATE';
  if (!reason && candidate.sessionId === previousSessionId) reason = 'PREVIOUS_SESSION_ID_REUSED';
  const prior = !reason && previousSessionId !== null ? sessions.find(s => s.sessionId === previousSessionId) : null;
  if (!reason && previousSessionId !== null && !prior) reason = 'PREVIOUS_SESSION_NOT_FOUND';
  if (!reason) reason = (prior?.state === 'ADMIN_REVIEW_REQUIRED' ? 'SESSION_ADMIN_REVIEW_REQUIRED' : null) ||
    pendingReason(pending) || (saveInProgress ? 'SAVE_IN_PROGRESS' : null);
  if (!reason && prior && !finished(prior, now)) reason = 'PREVIOUS_SESSION_NOT_ENDED';
  if (!reason) {
    const existing = sessions.find(s => s.sessionId === candidate.sessionId);
    if (existing && JSON.stringify(project(existing)) !== JSON.stringify(project(candidate))) reason = 'SESSION_ID_ALREADY_USED';
  }
  if (!reason) {
    // Project to ACTIVE only for evaluating the proposal; never mutate inputs.
    const proposed = { ...project(candidate), state: 'ACTIVE' };
    reason = sessionReason(proposed, now, allowTemporaryExceptions) ||
      uniquenessReason([...sessions.filter(s => s.sessionId !== candidate.sessionId), proposed], staff.staffId, now, allowTemporaryExceptions);
  }
  return { state: needsAdmin(reason) ? 'ADMIN_REVIEW_REQUIRED' : 'PENDING_APPROVAL',
    canApprove: !reason, requiresAdminReview: needsAdmin(reason) || needsAdmin(pendingReason(pending)), reason: reason ?? 'OK' };
}
function project(s) {
  return { sessionId: s.sessionId, staffId: s.staffId, state: s.state, issuedAt: s.issuedAt,
    expiresAt: s.expiresAt, revokedAt: s.revokedAt, endedAt: s.endedAt, exceptionUntil: s.exceptionUntil };
}
