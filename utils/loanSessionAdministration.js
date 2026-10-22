import { normalizeStaffId } from './normalizeStaffId.js';
import { evaluateLoanSessionApproval, evaluateLoanSessionHandover } from './loanSessionState.js';

export const LOAN_ADMIN_ROLES = Object.freeze({
  DEPARTMENT_ADMIN: 'DEPARTMENT_ADMIN', GLOBAL_ADMIN: 'GLOBAL_ADMIN',
});
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => typeof x === 'string' && x.length > 0 && x.length <= 256 && x.trim() === x &&
  !/[\/\u0000-\u001f\u007f]/.test(x) && x !== '.' && x !== '..';
const canonicalStaffId = x => id(x) && normalizeStaffId(x) === x;
// Revision 0 is the initial version; leave room for one safe integer increment.
const revision = x => Number.isSafeInteger(x) && x >= 0 && x < Number.MAX_SAFE_INTEGER;
const time = x => Number.isSafeInteger(x) && x >= 0 && x <= 8640000000000000;
const denied = (reason, requiresAdminReview = false) => ({ allowed: false, reason, requiresAdminReview, plan: null });

/** TRUST BOUNDARY: actor, staff, assignment, request, sessions and pending must be
 * authoritative server-loaded projections, NEVER browser/cookie self-assertions.
 * This module neither authenticates an actor nor grants/changes administrator roles.
 * Every mutable projection carries a revision; assignment is a per-staff serialization
 * point, including when no session exists. Complete sessions (including used IDs) are
 * required by Stage 1. No I/O, token issuance, storage or automatic pending resolution.
 */
export function evaluateLoanAdminScope(input = {}) {
  if (!object(input)) return denied('INVALID_INPUT');
  const { actor, staff } = input;
  if (!object(actor) || !id(actor.actorId) || !revision(actor.revision) || actor.isActive !== true ||
      !Object.values(LOAN_ADMIN_ROLES).includes(actor.role) || !Array.isArray(actor.wardIds) ||
      !actor.wardIds.every(id) || new Set(actor.wardIds).size !== actor.wardIds.length) return denied('INVALID_ACTOR');
  if (!object(staff) || !canonicalStaffId(staff.staffId) || !revision(staff.revision)) return denied('INVALID_STAFF');
  if (actor.role === LOAN_ADMIN_ROLES.DEPARTMENT_ADMIN && (!id(staff.wardId) || !actor.wardIds.includes(staff.wardId))) {
    return denied('OUTSIDE_DEPARTMENT');
  }
  return { allowed: true, reason: 'OK', requiresAdminReview: false, plan: null };
}
function concurrencyReason({ actor, staff, assignment, sessions, expected }) {
  if (!object(assignment) || assignment.staffId !== staff.staffId || !revision(assignment.revision) ||
      !(assignment.currentSessionId === null || id(assignment.currentSessionId)) ||
      !Array.isArray(sessions) || !sessions.every(s => object(s) && id(s.sessionId) && revision(s.revision)) ||
      !object(expected) || !revision(expected.actorRevision) || !revision(expected.staffRevision) ||
      !revision(expected.assignmentRevision)) return 'INVALID_CONCURRENCY_INPUT';
  if (actor.revision !== expected.actorRevision || staff.revision !== expected.staffRevision ||
      assignment.revision !== expected.assignmentRevision) return 'REVISION_MISMATCH';
  return null;
}
function guards(actor, staff, assignment, sessions) {
  return {
    actor: { actorId: actor.actorId, revision: actor.revision },
    staff: { staffId: staff.staffId, revision: staff.revision },
    assignment: { staffId: assignment.staffId, revision: assignment.revision, currentSessionId: assignment.currentSessionId },
    sessions: sessions.map(s => ({ sessionId: s.sessionId, revision: s.revision })),
  };
}
/** Returns a conditional intent, NOT a successful approval.
 * Future persistence MUST atomically reread actor/scope, staff, request, assignment,
 * prior/candidate sessions and pending/in-flight state; rerun this policy with a fresh
 * clock; compare ALL guards; reserve the globally unique new session ID; then update
 * request + session + per-staff assignment revision + audit together.
 * Every approval/revocation/writer must use that same assignment serialization point.
 * Revision equality alone does not cover expiry, deletion, pending changes or phantoms.
 */
export function planLoanSessionApproval(input = {}) {
  if (!object(input)) return denied('INVALID_INPUT');
  const { actor, staff, assignment, request, candidate, sessions, expected, pending, saveInProgress, now } = input;
  const scope = evaluateLoanAdminScope({ actor, staff });
  if (!scope.allowed) return scope;
  // New approvals require explicit active status; Stage 1 legacy compatibility
  // is intentionally not used to infer eligibility from a missing staff flag.
  if (staff.isActive !== true) return denied('STAFF_NOT_ACTIVE');
  const conflict = concurrencyReason(input);
  if (conflict) return denied(conflict);
  if (!time(now) || !object(request) || !id(request.requestId) || request.staffId !== staff.staffId ||
      !revision(request.revision) || !revision(expected.requestRevision) || !time(request.createdAt) ||
      !time(request.expiresAt) || request.createdAt >= request.expiresAt) return denied('INVALID_REQUEST');
  if (request.revision !== expected.requestRevision) return denied('REVISION_MISMATCH');
  if (request.status !== 'PENDING_APPROVAL') return denied('REQUEST_NOT_PENDING');
  if (now < request.createdAt || now >= request.expiresAt) return denied('REQUEST_EXPIRED_OR_NOT_YET_VALID');
  // The new session must be genuinely unused, not a renamed old/pending session.
  if (!object(candidate) || candidate.revision !== 0 || sessions.some(s => s.sessionId === candidate.sessionId)) return denied('SESSION_ID_ALREADY_USED');
  if (candidate.exceptionUntil !== undefined) return denied('EXCEPTION_NOT_SUPPORTED');
  const result = evaluateLoanSessionApproval({ candidate, previousSessionId: assignment.currentSessionId,
    staff, sessions, pending, saveInProgress, now });
  if (!result.canApprove) return denied(result.reason, result.requiresAdminReview);
  const preconditions = guards(actor, staff, assignment, sessions);
  preconditions.request = { requestId: request.requestId, revision: request.revision, status: request.status };
  return { allowed: true, reason: 'OK', requiresAdminReview: false, plan: {
    type: 'APPROVE_LOAN_SESSION', preconditions,
    changes: { request: { requestId: request.requestId, status: 'APPROVED', revision: request.revision + 1,
      approvedAt: now, approvedBy: actor.actorId },
    session: { sessionId: candidate.sessionId, staffId: staff.staffId, state: 'ACTIVE', issuedAt: candidate.issuedAt,
      expiresAt: candidate.expiresAt, revokedAt: null, endedAt: null, revision: 0 },
    assignment: { staffId: staff.staffId, currentSessionId: candidate.sessionId, revision: assignment.revision + 1 } },
  } };
}

/** Revocation removes access even if pending is unknown. It NEVER completes handover,
 * clears pending, or grants a replacement session. Future atomic persistence must
 * recheck these guards AND actor/scope/time, serialize on assignment, increment target
 * revision and assignment revision, and record an audit event. No writes happen here.
 */
export function planLoanSessionRevocation(input = {}) {
  if (!object(input)) return denied('INVALID_INPUT');
  const { actor, staff, assignment, sessions, sessionId, expected, pending, saveInProgress, now } = input;
  const scope = evaluateLoanAdminScope({ actor, staff });
  if (!scope.allowed) return scope;
  const conflict = concurrencyReason(input);
  if (conflict) return denied(conflict);
  if (!id(sessionId) || !revision(expected.sessionRevision)) return denied('INVALID_SESSION');
  const target = sessions.find(s => s.sessionId === sessionId);
  if (!target) return denied('SESSION_NOT_FOUND');
  if (target.staffId !== staff.staffId) return denied('SESSION_STAFF_MISMATCH');
  if (target.revision !== expected.sessionRevision) return denied('REVISION_MISMATCH');
  const decision = evaluateLoanSessionHandover({ sessionId, currentStaffId: staff.staffId, sessions, pending, saveInProgress, now });
  if (!decision.canEndSession) return denied(decision.reason, decision.requiresAdminReview);
  if (now < target.issuedAt) return denied('SESSION_NOT_YET_VALID');
  if (target.state === 'REVOKED' || target.state === 'ENDED' ||
      target.revokedAt !== null && now >= target.revokedAt || target.endedAt !== null && now >= target.endedAt) {
    return denied('SESSION_ALREADY_ENDED', decision.requiresAdminReview);
  }
  return { allowed: true, reason: 'OK', requiresAdminReview: decision.requiresAdminReview, plan: {
    type: 'REVOKE_LOAN_SESSION', preconditions: guards(actor, staff, assignment, sessions),
    changes: { session: { sessionId, state: 'REVOKED', revokedAt: now, revision: target.revision + 1 },
      // Keep the ended assignment ID for a subsequent safe handover; never erase it.
      assignment: { staffId: staff.staffId, currentSessionId: assignment.currentSessionId, revision: assignment.revision + 1 } },
  } };
}
