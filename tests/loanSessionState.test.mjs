import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateLoanSession as evaluate, evaluateLoanSessionHandover as handover,
  evaluateLoanSessionApproval as approval, LOAN_SESSION_STATES } from '../utils/loanSessionState.js';

const now = 2000;
const staff = (changes = {}) => ({ staffId: '0137', isActive: true, ...changes });
const session = (changes = {}) => ({ sessionId: 'session-A', staffId: '0137', state: 'ACTIVE',
  issuedAt: 1000, expiresAt: 3000, revokedAt: null, endedAt: null, ...changes });
const args = (changes = {}) => ({ sessionId: 'session-A', staff: staff(), sessions: [session()], pending: null, now, ...changes });
const transfer = (changes = {}) => ({ sessionId: 'session-A', currentStaffId: '0137', sessions: [session()],
  pending: null, saveInProgress: false, now, ...changes });
const candidate = (changes = {}) => session({ sessionId: 'session-B', staffId: '0245', state: 'PENDING_APPROVAL', ...changes });
const proposal = (changes = {}) => ({ candidate: candidate(), previousSessionId: 'session-A', staff: staff({ staffId: '0245' }),
  sessions: [session({ state: 'REVOKED', revokedAt: now })], pending: null, saveInProgress: false, now, ...changes });

test('ACTIVE correct staff can save/start a new record, without exposing input details', () => {
  assert.deepEqual(evaluate(args()), { state: 'ACTIVE', canSaveRecord: true, canStartNewRecord: true, requiresAdminReview: false, reason: 'OK' });
});
test('different staff and absent/unknown session cannot save', () => {
  assert.equal(evaluate(args({ staff: staff({ staffId: '0245' }) })).reason, 'SESSION_STAFF_MISMATCH');
  assert.equal(evaluate(args({ sessionId: null, sessions: [] })).state, 'UNREGISTERED');
  assert.equal(evaluate(args({ sessionId: 'unrecognized' })).canSaveRecord, false);
});
for (const state of Object.values(LOAN_SESSION_STATES).filter(s => s !== 'ACTIVE')) test(`${state} never grants save`, () => {
  const r = evaluate(args({ sessions: [session({ state })] })); assert.equal(r.canSaveRecord, false); assert.equal(r.canStartNewRecord, false);
});
for (const [time, expected, reason] of [[999, false, 'SESSION_NOT_YET_VALID'], [1000, true, 'OK'], [2999, true, 'OK'],
  [3000, false, 'SESSION_EXPIRED'], [3001, false, 'SESSION_EXPIRED']]) test(`issuance/expiry boundary ${time}`, () => {
  const r = evaluate(args({ now: time })); assert.equal(r.canSaveRecord, expected); assert.equal(r.reason, reason);
});
for (const field of ['revokedAt', 'endedAt']) for (const [time, allowed] of [[1999, true], [2000, false], [2001, false]]) test(`${field} becomes effective exactly at ${time}`, () => {
  const r = evaluate(args({ sessions: [session({ [field]: 2000 })], now: time })); assert.equal(r.canSaveRecord, allowed);
});
for (const isActive of [true, undefined, null, 0, 'false']) test(`existing isActive compatibility ${String(isActive)}`, () => {
  assert.equal(evaluate(args({ staff: staff({ isActive }) })).canSaveRecord, true);
});
test('retired and disabled staff deny saving', () => {
  assert.equal(evaluate(args({ staff: staff({ isActive: false }) })).reason, 'STAFF_RETIRED');
  assert.equal(evaluate(args({ staff: staff({ isDisabled: true }) })).reason, 'STAFF_DISABLED');
  assert.equal(evaluate(args({ staff: staff({ isDisabled: 'false' }) })).canSaveRecord, false);
});
for (const bad of [undefined, null, '2000', NaN, Infinity, -1, 2.5]) test(`invalid explicit clock ${String(bad)} fails closed`, () => {
  assert.equal(evaluate(args({ now: bad })).canSaveRecord, false);
  assert.equal(handover(transfer({ now: bad })).canChangeUser, false);
  assert.equal(approval(proposal({ now: bad })).canApprove, false);
});
for (const changes of [{ issuedAt: undefined }, { expiresAt: '3000' }, { expiresAt: Infinity }, { expiresAt: 1000 },
  { revokedAt: undefined }, { endedAt: NaN }, { revokedAt: 999 }, { state: 'active' }, { sessionId: '' }, { staffId: 137 },
  { staffId: '０１３７' }, { sessionId: 'a/b' }]) test(`malformed session ${Object.keys(changes)[0]} is rejected`, () => {
  assert.equal(evaluate(args({ sessions: [session(changes)] })).canSaveRecord, false);
});
for (const sessions of [undefined, null, {}, [null], [session(), session()]]) test(`missing/failed or duplicate snapshot cannot mean no sessions: ${JSON.stringify(sessions)}`, () => {
  const r = evaluate(args({ sessions })); assert.equal(r.canSaveRecord, false); assert.equal(r.requiresAdminReview, true);
});
for (const input of [undefined, null, {}]) test(`missing whole arguments ${String(input)} never grant permission`, () => {
  assert.equal(evaluate(input ?? undefined).canSaveRecord, false);
  assert.equal(handover(input ?? undefined).canChangeUser, false);
  assert.equal(approval(input ?? undefined).canApprove, false);
});
test('canonical staff ID preserves leading zero, does not accept numeric or full-width implicit identities', () => {
  for (const staffId of ['137', 137, '０１３７', ' 0137 ']) assert.equal(evaluate(args({ staff: staff({ staffId }) })).canSaveRecord, false);
});
test('normal handover can start but cannot grant next user or clear identity before session ends', () => {
  const r = handover(transfer()); assert.equal(r.canEndSession, true); assert.equal(r.canStartHandover, true);
  assert.equal(r.canChangeUser, false); assert.equal(r.canClearLocalIdentity, false); assert.equal(r.reason, 'SESSION_END_REQUIRED');
});
for (const state of ['REVOKED', 'ENDED']) test(`${state} permits handover completion only with no pending/in-flight save`, () => {
  const r = handover(transfer({ sessions: [session({ state })] })); assert.equal(r.canChangeUser, true); assert.equal(r.canClearLocalIdentity, true);
});
for (const status of ['unknown', 'check_failed', 'unresolved']) test(`pending ${status} blocks saves, handover and approval, requires admin; revocation stays possible`, () => {
  const pending = { status }, record = evaluate(args({ pending }));
  const r = handover(transfer({ pending })); const a = approval(proposal({ pending }));
  assert.equal(record.canSaveRecord, false); assert.equal(record.canStartNewRecord, false);
  assert.equal(r.state, 'ADMIN_REVIEW_REQUIRED'); assert.equal(r.requiresAdminReview, true); assert.equal(r.canEndSession, true);
  assert.equal(r.canChangeUser, false); assert.equal(r.canClearLocalIdentity, false); assert.equal(r.canStartHandover, false);
  assert.equal(a.canApprove, false); assert.equal(a.requiresAdminReview, true);
});
test('succeeded pending does not bypass existing H02 cleanup: only confirmed absence allows handover', () => {
  const sessions = [session({ state: 'ENDED' })], pending = { status: 'succeeded' };
  const r = handover(transfer({ sessions, pending })); assert.equal(r.canChangeUser, false); assert.equal(r.canResolveSucceededPending, true);
  assert.equal(r.requiresAdminReview, false); assert.equal(evaluate(args({ pending })).canSaveRecord, false);
  assert.equal(handover(transfer({ sessions, pending: null })).canChangeUser, true);
  assert.equal(approval(proposal({ pending })).canApprove, false); assert.equal(approval(proposal({ pending: null })).canApprove, true);
});
for (const pending of [undefined, false, [], {}, { status: 'failed' }, { status: 'not_saved' }, { status: 'unknown', resolved: true }]) test(`pending cannot become permission via coercion: ${JSON.stringify(pending)}`, () => {
  assert.equal(evaluate(args({ pending })).canSaveRecord, false); assert.equal(handover(transfer({ pending })).canChangeUser, false);
  assert.equal(approval(proposal({ pending })).canApprove, false);
});
test('unknown cannot be bypassed with new operation ID or acknowledgement/escrow claims', () => {
  const pending = { status: 'unknown', resolved: true, operationId: 'new-id', adminApproved: true, escrowed: true };
  assert.equal(evaluate(args({ pending })).canStartNewRecord, false); assert.equal(handover(transfer({ pending })).canChangeUser, false);
  assert.equal(approval(proposal({ pending })).canApprove, false);
});
test('ADMIN_REVIEW_REQUIRED is not cleared just by a missing pending flag', () => {
  const sessions = [session({ state: 'ADMIN_REVIEW_REQUIRED', revokedAt: now })];
  assert.equal(handover(transfer({ sessions })).requiresAdminReview, true);
  assert.equal(approval(proposal({ sessions })).requiresAdminReview, true);
});
test('wrong owner cannot end or change another user session', () => {
  const r = handover(transfer({ currentStaffId: '0245' })); assert.equal(r.canEndSession, false); assert.equal(r.canChangeUser, false);
});
for (const saveInProgress of [true, undefined]) test(`in-flight or unconfirmed save state ${String(saveInProgress)} stops change/approval`, () => {
  const r = handover(transfer({ sessions: [session({ state: 'REVOKED' })], saveInProgress }));
  assert.equal(r.canChangeUser, false); assert.equal(r.canClearLocalIdentity, false);
  assert.equal(approval(proposal({ saveInProgress })).canApprove, false);
});
test('new user approval requires a distinct pending session and terminated previous assignment', () => {
  assert.equal(approval(proposal()).canApprove, true);
  assert.equal(approval(proposal({ candidate: candidate({ sessionId: 'session-A' }) })).reason, 'PREVIOUS_SESSION_ID_REUSED');
  assert.equal(approval(proposal({ sessions: [session()] })).reason, 'PREVIOUS_SESSION_NOT_ENDED');
  assert.equal(approval(proposal({ sessions: [] })).reason, 'PREVIOUS_SESSION_NOT_FOUND');
  assert.equal(approval(proposal({ candidate: candidate({ staffId: '0137' }) })).canApprove, false);
});
test('revocation boundary is also enforced on approving a replacement', () => {
  const sessions = [session({ revokedAt: 2000 })];
  assert.equal(approval(proposal({ sessions, now: 1999 })).canApprove, false);
  assert.equal(approval(proposal({ sessions, now: 2000 })).canApprove, true);
});
test('initial registration with explicit no prior assignment may be evaluated, never automatically approved from staff ID alone', () => {
  assert.equal(approval(proposal({ previousSessionId: null, sessions: [] })).canApprove, true);
  assert.equal(approval({ staff: staff(), now }).canApprove, false);
  assert.equal(approval(proposal({ previousSessionId: undefined })).canApprove, false);
});
for (const changes of [{ state: 'ACTIVE' }, { state: 'ENDED' }, { issuedAt: 2001 }, { expiresAt: 2000 }, { revokedAt: now }, { endedAt: now }]) test(`invalid candidate ${Object.keys(changes)[0]} cannot approve`, () => {
  assert.equal(approval(proposal({ candidate: candidate(changes) })).canApprove, false);
});
test('matching pending proposal may already exist, but ACTIVE/ended ID reuse is denied', () => {
  assert.equal(approval(proposal({ sessions: [session({ state: 'ENDED' }), candidate()] })).canApprove, true);
  for (const state of ['ACTIVE', 'REVOKED', 'ENDED']) {
    assert.equal(approval(proposal({ sessions: [session({ state: 'ENDED' }), candidate({ state })] })).reason, 'SESSION_ID_ALREADY_USED');
  }
});
test('two normal ACTIVE sessions for same staff are detected; other staff and expired/ended sessions do not conflict', () => {
  const second = session({ sessionId: 'second' });
  assert.equal(evaluate(args({ sessions: [session(), second] })).reason, 'MULTIPLE_ACTIVE_SESSIONS');
  assert.equal(approval(proposal({ previousSessionId: null, candidate: candidate({ staffId: '0137' }), staff: staff(), sessions: [session()] })).reason, 'MULTIPLE_ACTIVE_SESSIONS');
  for (const change of [{ staffId: '0245' }, { expiresAt: now }, { state: 'ENDED' }, { revokedAt: now }]) {
    assert.equal(evaluate(args({ sessions: [session(), session({ sessionId: 'second', ...change })] })).canSaveRecord, true);
  }
});
test('time-limited exception is explicitly opt-in and never hides duplicate normal sessions', () => {
  const exception = session({ sessionId: 'exception', exceptionUntil: 2500 });
  assert.equal(evaluate(args({ sessions: [session(), exception] })).canSaveRecord, false);
  assert.equal(evaluate(args({ sessionId: 'exception', sessions: [session(), exception], allowTemporaryExceptions: true })).canSaveRecord, true);
  assert.equal(evaluate(args({ sessionId: 'exception', sessions: [session(), exception], allowTemporaryExceptions: true, now: 2500 })).reason, 'EXCEPTION_EXPIRED');
  assert.equal(evaluate(args({ sessionId: 'exception', sessions: [session(), session({ sessionId: 'second' }), exception], allowTemporaryExceptions: true })).canSaveRecord, false);
});
test('exception proposal needs explicit policy and expires at its exact deadline', () => {
  const candidateSession = candidate({ exceptionUntil: 2500 });
  assert.equal(approval(proposal({ candidate: candidateSession })).reason, 'EXCEPTION_NOT_ALLOWED');
  assert.equal(approval(proposal({ candidate: candidateSession, allowTemporaryExceptions: true })).canApprove, true);
  assert.equal(approval(proposal({ candidate: candidateSession, allowTemporaryExceptions: true, now: 2500 })).reason, 'EXCEPTION_EXPIRED');
});
test('revocation/save race is a snapshot decision, not permission lasting until commit', () => {
  const before = args(); assert.equal(evaluate(before).canSaveRecord, true);
  const revokedSnapshot = args({ sessions: [session({ revokedAt: now })] }); assert.equal(evaluate(revokedSnapshot).canSaveRecord, false);
  const handoverSnapshot = args({ sessions: [session({ state: 'HANDOVER' })] }); assert.equal(evaluate(handoverSnapshot).canSaveRecord, false);
  assert.equal(approval(proposal({ sessions: [session({ revokedAt: now })], saveInProgress: true })).canApprove, false);
  assert.equal(evaluate(before).canSaveRecord, true, 'old snapshot remains old; caller must reread/recheck at commit');
});
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
test('pure decisions do not mutate data, copy personal info, issue IDs or revive unknown operations', () => {
  const input = freeze(args({ staff: staff({ name: 'PRIVATE-NAME' }) })); const before = JSON.stringify(input);
  evaluate(input); assert.equal(JSON.stringify(input), before);
  const change = freeze(transfer()); handover(change);
  const next = freeze(proposal()); assert.equal(approval(next).canApprove, true);
  assert.equal(JSON.stringify(evaluate(input)).includes('PRIVATE-NAME'), false);
  const source = readFileSync(new URL('../utils/loanSessionState.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /firebase|fetch\s*\(|localStorage|sessionStorage|Date\.now|new Date|Math\.random|randomUUID|console\.|process\.env|operationId\s*:/);
  assert.match(source, /isActiveStaff\(staff\)/); assert.match(source, /re-evaluate authoritative state atomically/);
});
test('unknown still requires admin review when another denial already applies', () => {
  for (const state of ['HANDOVER', 'REVOKED', 'ENDED', 'PENDING_APPROVAL']) {
    const r = evaluate(args({ sessions: [session({ state })], pending: { status: 'unknown' } }));
    assert.equal(r.canSaveRecord, false); assert.equal(r.requiresAdminReview, true);
  }
  const r = approval(proposal({ staff: staff({ staffId: '0245', isActive: false }), pending: { status: 'unknown' } }));
  assert.equal(r.canApprove, false); assert.equal(r.requiresAdminReview, true);
});
