import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateLoanAdminScope as scope, planLoanSessionApproval as approve,
  planLoanSessionRevocation as revoke } from '../utils/loanSessionAdministration.js';

const session = (extra = {}) => ({ sessionId: 'new-session', staffId: '001', state: 'PENDING_APPROVAL',
  issuedAt: 1000, expiresAt: 5000, revokedAt: null, endedAt: null, revision: 0, ...extra });
const fixture = () => ({
  actor: { actorId: 'admin-1', role: 'DEPARTMENT_ADMIN', wardIds: ['78f'], isActive: true, revision: 1 },
  staff: { staffId: '001', wardId: '78f', isActive: true, isDisabled: false, revision: 2 },
  request: { requestId: 'request-1', staffId: '001', status: 'PENDING_APPROVAL', createdAt: 1000, expiresAt: 3000, revision: 3 },
  candidate: session(), sessions: [], assignment: { staffId: '001', currentSessionId: null, revision: 4 },
  expected: { actorRevision: 1, staffRevision: 2, requestRevision: 3, assignmentRevision: 4 },
  pending: null, saveInProgress: false, now: 2000,
});
const revocation = () => ({ ...fixture(), sessionId: 'old-session',
  sessions: [session({ sessionId: 'old-session', state: 'ACTIVE', revision: 5 })],
  expected: { ...fixture().expected, sessionRevision: 5 },
  assignment: { staffId: '001', currentSessionId: 'old-session', revision: 4 },
});

test('department approval emits only conditional intent; preserves leading-zero staff ID', () => {
  const r = approve(fixture()); assert.equal(r.allowed, true);
  assert.equal(r.plan.changes.session.staffId, '001');
  assert.equal(r.plan.changes.request.approvedBy, 'admin-1');
  assert.equal(r.plan.changes.assignment.revision, 5);
  assert.equal(r.plan.preconditions.request.revision, 3);
});
for (const role of ['DEPARTMENT_ADMIN', 'GLOBAL_ADMIN']) test(`${role} own department scope`, () => {
  const x = fixture(); x.actor.role = role; assert.equal(scope(x).allowed, true);
});
test('department admin cannot cross ward; global admin can', () => {
  const x = fixture(); x.staff.wardId = '4f';
  assert.equal(approve(x).reason, 'OUTSIDE_DEPARTMENT');
  x.actor.role = 'GLOBAL_ADMIN'; assert.equal(approve(x).allowed, true);
});
for (const changes of [{ isActive: false }, { isActive: undefined }, { role: 'admin' }, { role: null },
  { wardIds: ['78f', '78f'] }, { wardIds: undefined }, { actorId: '' }, { revision: NaN }]) test(`invalid actor ${JSON.stringify(changes)} denies approval/revocation`, () => {
  for (const [fn, base] of [[approve, fixture], [revoke, revocation]]) {
    const x = base(); Object.assign(x.actor, changes); assert.equal(fn(x).allowed, false);
  }
});
test('self-asserted scope/role in extraneous request or cookie input cannot expand trusted actor scope', () => {
  const x = fixture(); x.staff.wardId = '4f'; x.role = 'GLOBAL_ADMIN'; x.wardIds = ['4f'];
  x.request.role = 'GLOBAL_ADMIN'; x.cookie = { role: 'GLOBAL_ADMIN' };
  assert.equal(approve(x).reason, 'OUTSIDE_DEPARTMENT');
});
for (const now of [999, 3000, 3001]) test(`request unavailable at ${now}`, () => {
  const x = fixture(); x.now = now; assert.equal(approve(x).allowed, false);
});
for (const now of [1000, 2999]) test(`request within interval at ${now}`, () => {
  const x = fixture(); x.now = now; assert.equal(approve(x).allowed, true);
});
for (const status of ['APPROVED', 'REVOKED', 'ENDED', undefined]) test(`request ${status} cannot approve`, () => {
  const x = fixture(); x.request.status = status; assert.equal(approve(x).reason, 'REQUEST_NOT_PENDING');
});
test('request staff mismatch rejects', () => {
  const x = fixture(); x.request.staffId = '002'; assert.equal(approve(x).reason, 'INVALID_REQUEST');
});
for (const field of ['actorRevision', 'staffRevision', 'assignmentRevision', 'requestRevision']) test(`stale ${field} rejects`, () => {
  const x = fixture(); x.expected[field]++; assert.equal(approve(x).reason, 'REVISION_MISMATCH');
});
for (const field of ['createdAt', 'expiresAt', 'revision']) for (const value of [undefined, NaN, Infinity, '1000', -1]) test(`invalid request ${field} ${String(value)}`, () => {
  const x = fixture(); x.request[field] = value; assert.equal(approve(x).allowed, false);
});
for (const change of [{ isActive: false }, { isDisabled: true }]) test(`staff blocked ${JSON.stringify(change)}`, () => {
  const x = fixture(); Object.assign(x.staff, change); assert.equal(approve(x).allowed, false);
  // A retired/disabled user's access must still be revocable.
  const y = revocation(); Object.assign(y.staff, change); assert.equal(revoke(y).allowed, true);
});
test('existing normal ACTIVE prevents second normal session', () => {
  const x = fixture(); x.sessions = [session({ sessionId: 'other', state: 'ACTIVE' })];
  assert.equal(approve(x).reason, 'MULTIPLE_ACTIVE_SESSIONS');
});
test('old session cannot be renamed or reused even for a different staff', () => {
  const x = fixture(); x.sessions = [session({ staffId: '002', state: 'ENDED' })];
  assert.equal(approve(x).reason, 'SESSION_ID_ALREADY_USED');
});
test('replacement requires ended old session and a distinct fresh ID', () => {
  const x = fixture(); x.assignment.currentSessionId = 'old';
  x.sessions = [session({ sessionId: 'old', staffId: '002', state: 'ACTIVE' })];
  assert.equal(approve(x).reason, 'PREVIOUS_SESSION_NOT_ENDED');
  x.sessions[0].state = 'ENDED'; assert.equal(approve(x).allowed, true);
  x.candidate.sessionId = 'old'; assert.equal(approve(x).allowed, false);
});
for (const status of ['unknown', 'check_failed', 'unresolved', 'succeeded']) test(`pending ${status} blocks approval, never blocks security revocation`, () => {
  const x = fixture(); x.pending = { status, resolved: true, newOperationAllowed: true };
  const r = approve(x); assert.equal(r.allowed, false); assert.equal(r.plan, null);
  assert.equal(r.requiresAdminReview, status !== 'succeeded');
  const y = revocation(); y.pending = x.pending; const end = revoke(y);
  assert.equal(end.allowed, true); assert.equal(end.requiresAdminReview, status !== 'succeeded');
  assert.equal('pending' in end.plan.changes, false);
});
test('missing pending or in-flight confirmation cannot grant approval', () => {
  for (const [key, value] of [['pending', undefined], ['saveInProgress', undefined], ['saveInProgress', true]]) {
    const x = fixture(); x[key] = value; assert.equal(approve(x).allowed, false);
  }
});
test('revocation own ward allowed, other ward denied; global permitted', () => {
  const x = revocation(); assert.equal(revoke(x).allowed, true);
  x.staff.wardId = '4f'; assert.equal(revoke(x).reason, 'OUTSIDE_DEPARTMENT');
  x.actor.role = 'GLOBAL_ADMIN'; assert.equal(revoke(x).allowed, true);
});
test('session staff mismatch and stale revision reject revocation', () => {
  const x = revocation(); x.sessions[0].staffId = '002'; assert.equal(revoke(x).reason, 'SESSION_STAFF_MISMATCH');
  const y = revocation(); y.expected.sessionRevision++; assert.equal(revoke(y).reason, 'REVISION_MISMATCH');
});
for (const change of [{ state: 'REVOKED' }, { state: 'ENDED' }, { revokedAt: 2000 }, { endedAt: 2000 }]) test(`already ended revocation is explicit no-op denial ${JSON.stringify(change)}`, () => {
  const x = revocation(); Object.assign(x.sessions[0], change);
  const r = revoke(x); assert.equal(r.reason, 'SESSION_ALREADY_ENDED'); assert.equal(r.plan, null);
});
test('scheduled revocation can be brought forward, exact boundary no longer writes', () => {
  const x = revocation(); x.sessions[0].revokedAt = 2001; assert.equal(revoke(x).allowed, true);
  x.now = 2001; assert.equal(revoke(x).allowed, false);
});
for (const now of [undefined, NaN, Infinity, '2000', -1]) test(`invalid clock ${String(now)} fails closed`, () => {
  const x = fixture(); x.now = now; assert.equal(approve(x).allowed, false);
  const y = revocation(); y.now = now; assert.equal(revoke(y).allowed, false);
});
for (const fn of [approve, revoke, scope]) test(`${fn.name} missing inputs fail closed`, () => {
  assert.equal(fn().allowed, false); assert.equal(fn({}).allowed, false);
});

// Mock persistence illustrates the REQUIRED atomic CAS. It is not a production
// storage implementation. Real storage must reread/rerun policy (expiry, scope,
// staff, pending and complete sessions), not merely compare a request revision.
function commitMock(snapshot, plan) {
  assert.equal(snapshot.actor.revision, plan.preconditions.actor.revision);
  assert.equal(snapshot.staff.revision, plan.preconditions.staff.revision);
  assert.equal(snapshot.assignment.revision, plan.preconditions.assignment.revision);
  assert.equal(snapshot.request.revision, plan.preconditions.request.revision);
  assert.equal(approve(snapshot).allowed, true);
  snapshot.request = { ...snapshot.request, ...plan.changes.request };
  snapshot.assignment = { ...plan.changes.assignment };
  snapshot.sessions.push({ ...plan.changes.session });
}
test('mock atomic commit: two approvals of same request only first succeeds', () => {
  const db = fixture(); const a = approve(db), b = approve(db);
  commitMock(db, a.plan); assert.throws(() => commitMock(db, b.plan));
  assert.equal(db.sessions.length, 1); assert.equal(approve(db).allowed, false);
});
test('mock shared staff assignment CAS prevents separate requests creating two ACTIVE sessions', () => {
  const db = fixture(); const other = fixture(); other.request.requestId = 'request-2'; other.candidate.sessionId = 'new-2';
  const b = approve(other); commitMock(db, approve(db).plan);
  other.assignment = db.assignment; other.sessions = db.sessions;
  assert.throws(() => commitMock(other, b.plan)); assert.equal(approve(other).allowed, false);
});
test('policy must recheck time and actor disablement even if earlier intent allowed', () => {
  const x = fixture(); assert.equal(approve(x).allowed, true);
  x.now = 3000; assert.equal(approve(x).allowed, false);
  x.now = 2000; x.actor.isActive = false; assert.equal(approve(x).allowed, false);
});
test('pure projections do not mutate inputs or leak names/credentials', () => {
  function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
  for (const [fn, x] of [[approve, fixture()], [revoke, revocation()]]) {
    x.staff.name = 'PRIVATE'; x.actor.token = 'SECRET'; const before = JSON.stringify(x);
    const r = fn(freeze(x)); assert.equal(JSON.stringify(x), before);
    assert.equal(JSON.stringify(r).includes('PRIVATE'), false); assert.equal(JSON.stringify(r).includes('SECRET'), false);
  }
  const source = readFileSync(new URL('../utils/loanSessionAdministration.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /firebase|fetch\s*\(|localStorage|sessionStorage|Date\.now|new Date|randomUUID|console\.|process\.env/);
  assert.match(source, /evaluateLoanSessionApproval\(/); assert.match(source, /evaluateLoanSessionHandover\(/);
});

for (const value of [true, false, undefined, null, 0, 1, 'true', 'false', {}, []]) test(`approval requires literal active true: ${String(value)}`, () => {
  const x = fixture(); x.staff.isActive = value;
  assert.equal(approve(x).allowed, value === true);
  const y = revocation(); y.staff.isActive = value;
  assert.equal(revoke(y).allowed, true, 'unknown/retired staff access must remain revocable');
});
for (const fn of [scope, approve, revoke]) for (const value of [null, [], '', 'invalid', 0, 1, false, true, NaN, Symbol('invalid'), () => {}]) {
  test(`${fn.name} safely rejects top-level ${String(value)}`, () => {
    assert.deepEqual(fn(value), { allowed: false, reason: 'INVALID_INPUT', requiresAdminReview: false, plan: null });
  });
}
test('empty department assignment rejects approval and revocation', () => {
  for (const [fn, create] of [[approve, fixture], [revoke, revocation]]) {
    const x = create(); x.actor.wardIds = []; assert.equal(fn(x).reason, 'OUTSIDE_DEPARTMENT');
  }
});
for (const wardId of ['78f', '4f', '5f']) test(`multiple assigned departments scope ${wardId}`, () => {
  for (const [fn, create] of [[approve, fixture], [revoke, revocation]]) {
    const x = create(); x.actor.wardIds = ['78f', '4f']; x.staff.wardId = wardId;
    assert.equal(fn(x).allowed, wardId !== '5f');
  }
});
for (const wardId of [undefined, null, '', 0]) test(`missing/invalid staff ward ${String(wardId)} denies department admin`, () => {
  for (const [fn, create] of [[approve, fixture], [revoke, revocation]]) {
    const x = create(); x.staff.wardId = wardId; assert.equal(fn(x).allowed, false);
  }
});
test('duplicate departments never expand scope even if they contain the requested ward', () => {
  const x = fixture(); x.actor.wardIds = ['78f', '4f', '4f']; x.staff.wardId = '4f';
  assert.equal(approve(x).reason, 'INVALID_ACTOR');
});
test('missing request staff or session staff never produces a plan', () => {
  const x = fixture(); delete x.request.staffId; assert.equal(approve(x).plan, null);
  const y = revocation(); delete y.sessions[0].staffId; assert.equal(revoke(y).plan, null);
});
const invalidRevisions = [undefined, null, '0', NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER];
const approvalRevisionPaths = [ ['actor', 'revision'], ['staff', 'revision'], ['request', 'revision'],
  ['assignment', 'revision'], ['candidate', 'revision'], ['expected', 'actorRevision'],
  ['expected', 'staffRevision'], ['expected', 'requestRevision'], ['expected', 'assignmentRevision'] ];
const revocationRevisionPaths = [ ['actor', 'revision'], ['staff', 'revision'], ['assignment', 'revision'],
  ['expected', 'actorRevision'], ['expected', 'staffRevision'], ['expected', 'assignmentRevision'], ['expected', 'sessionRevision'] ];
for (const [fn, create, paths] of [[approve, fixture, approvalRevisionPaths], [revoke, revocation, revocationRevisionPaths]]) {
  for (const [owner, field] of paths) for (const value of invalidRevisions) test(`${fn.name} rejects ${owner}.${field}=${String(value)}`, () => {
    const x = create(); x[owner][field] = value; assert.equal(fn(x).allowed, false); assert.equal(fn(x).plan, null);
  });
  for (const value of invalidRevisions) test(`${fn.name} rejects existing session revision=${String(value)}`, () => {
    const x = create();
    if (fn === approve) x.sessions = [session({ sessionId: 'ended', state: 'ENDED', revision: value })];
    else x.sessions[0].revision = value;
    assert.equal(fn(x).allowed, false); assert.equal(fn(x).plan, null);
  });
}
test('revision zero is an initial version, and a successful plan increments mutable existing versions', () => {
  const x = fixture(); x.actor.revision = x.staff.revision = x.request.revision = x.assignment.revision = 0;
  Object.keys(x.expected).forEach(k => { x.expected[k] = 0; });
  const r = approve(x); assert.equal(r.allowed, true);
  assert.equal(r.plan.changes.request.revision, 1); assert.equal(r.plan.changes.assignment.revision, 1);
  const y = revocation(); y.actor.revision = y.staff.revision = y.assignment.revision = y.sessions[0].revision = 0;
  Object.keys(y.expected).forEach(k => { y.expected[k] = 0; });
  const end = revoke(y); assert.equal(end.allowed, true);
  assert.equal(end.plan.changes.session.revision, 1); assert.equal(end.plan.changes.assignment.revision, 1);
});
for (const change of [{}, { isActive: false }, { isActive: undefined }, { revision: null }]) test(`global admin still requires valid actor ${JSON.stringify(change)}`, () => {
  for (const [fn, create] of [[approve, fixture], [revoke, revocation]]) {
    const x = create(); x.actor.role = 'GLOBAL_ADMIN'; x.staff.wardId = 'other'; Object.assign(x.actor, change);
    assert.equal(fn(x).allowed, Object.keys(change).length === 0);
  }
});
for (const pending of [{ status: 'unknown' }, { status: 'check_failed' }, { status: 'invalid' }, {}, [], false, 'unknown', 1]) {
  test(`invalid/unresolved pending ${JSON.stringify(pending)} blocks approval but not security revocation`, () => {
    const x = fixture(); x.pending = pending;
    assert.equal(approve(x).allowed, false); assert.equal(approve(x).requiresAdminReview, true);
    const y = revocation(); y.pending = pending; const r = revoke(y);
    assert.equal(r.allowed, true); assert.equal(r.requiresAdminReview, true);
    assert.deepEqual(Object.keys(r.plan.changes).sort(), ['assignment', 'session']);
  });
}
for (const sessions of [undefined, null, {}, [null], [session({ sessionId: 'broken', state: 'ACTIVE', expiresAt: undefined })]]) {
  test(`missing/malformed session snapshot fails closed ${JSON.stringify(sessions)}`, () => {
    for (const [fn, create] of [[approve, fixture], [revoke, revocation]]) {
      const x = create(); x.sessions = sessions; assert.equal(fn(x).allowed, false);
    }
  });
}
