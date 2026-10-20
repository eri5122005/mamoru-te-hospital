import { normalizeStaffId } from './normalizeStaffId.js';
import { isActiveStaff } from './isActiveStaff.js';
import { calculateWeightUsage } from './calculateWeightUsage.js';
import { evaluateWeightRemeasurement, WEIGHT_REMEASUREMENT_RULES } from './weightRemeasurement.js';
import { fetchRecentNormalWeightHistory } from './fetchRecentNormalWeightHistory.js';

export class WeightPrecheckReadError extends Error {
  constructor(phase, cause) {
    super('Weight precheck read unavailable', { cause });
    this.name = 'WeightPrecheckReadError';
    this.phase = phase; // 'staff' or 'history'; never expose cause directly to end users.
  }
}

async function readServerStaff({ db, staffId }) {
  const { doc, getDocFromServer } = await import('firebase/firestore');
  const snapshot = await getDocFromServer(doc(db, 'staff', staffId));
  if (!snapshot.exists()) return null;
  // No whole staff object is returned to the caller or used as an authentication claim.
  return { isActive: snapshot.get('isActive'), lastWeight: snapshot.get('lastWeight') };
}

function numericWeight(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (typeof value === 'string' && !value.trim()) return NaN;
  return Number(value);
}

/**
 * READ-ONLY precheck, not authorization and NOT a save guarantee. Used before the records save transaction.
 * The final save transaction MUST recheck existence, isActive, DB weight and request weight.
 * External history reads are not a snapshot; no revision/idempotency guarantee is provided.
 * A submitted exchange flag bypasses A/B by current policy, NOT proof of actual exchange.
 * Dependencies are injected in tests; importing this module initializes no Firebase app.
 */
export async function precheckWeightRemeasurement(
  { db, staffId, requestWeightPrev, weightNow, isBottleExchange, evaluatedAt = new Date() },
  { readStaff = readServerStaff, readHistory = fetchRecentNormalWeightHistory } = {},
) {
  if (typeof staffId !== 'string' || !staffId || normalizeStaffId(staffId) !== staffId ||
      staffId.includes('/') || staffId === '.' || staffId === '..') return { status: 'invalid_request' };
  const previous = numericWeight(requestWeightPrev), current = numericWeight(weightNow);
  if (!Number.isFinite(previous) || previous < 45 || previous > 263 ||
      !Number.isFinite(current) || current <= 45 || current > 263 || typeof isBottleExchange !== 'boolean') {
    return { status: 'invalid_request' };
  }
  // Reuse Step 1's evaluation date validation, before any reads. Invalid configuration throws.
  evaluateWeightRemeasurement({ currentMl: 0, isBottleExchange, history: [], evaluatedAt });
  let staff;
  try { staff = await readStaff({ db, staffId }); }
  catch (cause) { throw new WeightPrecheckReadError('staff', cause); }
  if (staff === null) return { status: 'staff_not_found' };
  if (!staff || typeof staff !== 'object' || Array.isArray(staff)) throw new TypeError('Invalid staff read result');
  if (!isActiveStaff(staff)) return { status: 'staff_inactive' };
  const dbWeight = numericWeight(staff.lastWeight);
  if (!Number.isFinite(dbWeight) || dbWeight < 45 || dbWeight > 263) return { status: 'invalid_db_weight' };
  if (dbWeight !== previous) return { status: 'previous_weight_mismatch' };

  // Same helper and two-decimal rounding as the save API, using the verified DB weight.
  const currentMl = calculateWeightUsage(dbWeight, current, isBottleExchange);
  const preliminary = evaluateWeightRemeasurement({ currentMl, isBottleExchange, history: [], evaluatedAt });
  const decisionResult = (decision, historyStatus) => ({
    status: decision.requiresRemeasurement ? 'remeasurement_required' : 'ok',
    previousWeight: dbWeight, ...decision, historyStatus,
  });
  // Empty history means intentionally NOT READ here, not a successful insufficient query.
  // For B, A remains unevaluated. Exchange is exempt, pending separate exchange protections.
  if (isBottleExchange || preliminary.requiresRemeasurement) return decisionResult(preliminary, 'not_read');

  let historyResult;
  try { historyResult = await readHistory({ db, staffId, evaluatedAt }); }
  catch (cause) { throw new WeightPrecheckReadError('history', cause); }
  if (historyResult?.status === 'limit_reached') return { status: 'history_limit_reached', currentMl };
  if (!historyResult || !['complete', 'insufficient'].includes(historyResult.status) || !Array.isArray(historyResult.history) ||
      (historyResult.status === 'complete' ? historyResult.history.length !== WEIGHT_REMEASUREMENT_RULES.historyCount
        : historyResult.history.length >= WEIGHT_REMEASUREMENT_RULES.historyCount)) throw new TypeError('Invalid history read result');
  const decision = evaluateWeightRemeasurement({ currentMl, isBottleExchange, history: historyResult.history, evaluatedAt });
  if (historyResult.status === 'complete' && !decision.baselineAvailable) throw new TypeError('Incomplete eligible baseline');
  return decisionResult(decision, historyResult.status);
}
