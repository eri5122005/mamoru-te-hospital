import { normalizeStaffId } from '../normalizeStaffId.js';
import { isRecordOperationId } from '../recordOperationId.js';
import { calculateWeightUsage } from '../calculateWeightUsage.js';
import { precheckWeightRemeasurement, WeightPrecheckReadError } from '../precheckWeightRemeasurement.js';
import { issueWeightChallenge, verifyWeightChallenge, WeightChallengeError, WEIGHT_CHALLENGE_POLICY } from './weightRemeasurementChallenge.js';

export const WEIGHT_REMEASUREMENT_RULE_VERSION = 'weight_v1';
const challengeStatuses = Object.freeze({
  WEIGHT_CHALLENGE_UNAVAILABLE: 'challenge_unavailable',
  WEIGHT_CHALLENGE_INVALID: 'challenge_invalid',
  WEIGHT_CHALLENGE_EXPIRED: 'challenge_expired',
  WEIGHT_CHALLENGE_WRONG_STAGE: 'challenge_wrong_stage',
  WEIGHT_CHALLENGE_OPERATION_MISMATCH: 'challenge_operation_mismatch',
});
const stopStatuses = new Set(['staff_not_found','staff_inactive','invalid_db_weight','previous_weight_mismatch','history_limit_reached','invalid_request']);
const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) ? Number(value) : NaN;
const validClock = n => Number.isSafeInteger(n) && n > 0 && n <= 8640000000000000;

/** Side-effect-free final check; safe to repeat inside a save transaction.
 * No staff/history reads, issuance, logging or HTTP responses occur here.
 */
export function checkWeightFlowChallenge(request, {
  appBuildId, nowMs = Date.now(), secret = process.env.WEIGHT_REMEASUREMENT_SIGNING_SECRET,
  allowLegacy = true,
} = {}) {
  const { operation, challenge, staffId, requestWeightPrev, weightNow, isBottleExchange, operationId } = request;
  if (!['remeasure','confirm_remeasurement'].includes(operation)) return { status: 'invalid_request' };
  const expectedStage = operation === 'remeasure' ? 'remeasure' : 'confirm';
  try {
    const token = verifyWeightChallenge(challenge, { expectedStage, expectedOperationId: operationId, nowMs, secret, allowLegacy });
    if (token.staffId !== staffId) return { status: 'challenge_staff_mismatch' };
    if (token.previousWeight !== number(requestWeightPrev)) return { status: 'challenge_previous_weight_mismatch' };
    if (token.appBuildId !== appBuildId) return { status: 'challenge_app_version_mismatch' };
    if (token.ruleVersion !== WEIGHT_REMEASUREMENT_RULE_VERSION) return { status: 'challenge_rule_version_mismatch' };
    if (isBottleExchange !== false) return { status: 'invalid_request' };
    if (operation === 'confirm_remeasurement' && token.weightNow !== number(weightNow)) return { status: 'challenge_weight_mismatch' };
    return { status: 'valid', payload: token };
  } catch (error) {
    if (error instanceof WeightChallengeError) return { status: challengeStatuses[error.code] ?? 'challenge_invalid' };
    throw error;
  }
}

/**
 * Server-side decision orchestration only; the API owns the final save transaction.
 * precheck is a trusted server dependency, not a client-supplied result. The final save
 * transaction MUST recheck staff existence/active/DB weight, expiry and calculated ml.
 * No history snapshot/revision or baselineDigest guarantee; no token consumption/replay state.
 * These two challenge stages are exclusively NORMAL records: incoming exchange=true with
 * a challenge is rejected. Challenge-less exchange remains a known separate bypass.
 */
export async function evaluateWeightRemeasurementFlow(request, {
  appBuildId,
  now = Date.now,
  secret = process.env.WEIGHT_REMEASUREMENT_SIGNING_SECRET,
  precheck = precheckWeightRemeasurement,
  // Temporary compatibility for the current UI. Set false when IDs become mandatory.
  allowLegacy = true,
} = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return { status: 'invalid_request' };
  const { db, staffId, requestWeightPrev, weightNow, isBottleExchange, challenge, operationId } = request;
  const operation = request.operation === undefined ? 'initial' : request.operation;
  const previous = number(requestWeightPrev), current = number(weightNow), startedAt = now();
  if (!['initial','remeasure','confirm_remeasurement'].includes(operation) ||
      (operationId === undefined ? !allowLegacy : !isRecordOperationId(operationId)) ||
      typeof staffId !== 'string' || !staffId || normalizeStaffId(staffId) !== staffId ||
      staffId.includes('/') || staffId === '.' || staffId === '..' ||
      !Number.isFinite(previous) || previous < 45 || previous > 263 ||
      !Number.isFinite(current) || current <= 45 || current > 263 || typeof isBottleExchange !== 'boolean' ||
      typeof appBuildId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(appBuildId) || !validClock(startedAt) ||
      operation === 'initial' && challenge !== undefined) return { status: 'invalid_request' };

  let token;
  try {
    if (operation !== 'initial') {
      // Invalid/expired tokens and request binding failures never reach precheck reads.
      const verified = checkWeightFlowChallenge(request, { appBuildId, nowMs: startedAt, secret, allowLegacy });
      if (verified.status !== 'valid') return verified;
      token = verified.payload;
    }

    let checked;
    try {
      checked = await precheck({ db, staffId, requestWeightPrev: previous, weightNow: current,
        isBottleExchange, evaluatedAt: new Date(startedAt) });
    } catch (error) {
      if (error instanceof WeightPrecheckReadError) return { status: error.phase === 'history' ? 'history_unavailable' : 'staff_weight_unavailable' };
      throw error; // Programming/contract failures also fail closed, never become permission to save.
    }
    if (stopStatuses.has(checked?.status)) {
      return { status: token && checked.status === 'previous_weight_mismatch' ? 'challenge_previous_weight_mismatch' : checked.status };
    }
    if (!checked || !['ok','remeasurement_required'].includes(checked.status) ||
        !Number.isFinite(checked.previousWeight) || checked.previousWeight !== previous) throw new TypeError('Invalid trusted precheck result');
    const currentMl = calculateWeightUsage(checked.previousWeight, current, isBottleExchange);
    // Payload ml/median/rules are never inputs to this computation or the latest decision.
    const details = { currentMl, previousWeight: checked.previousWeight, weightNow: current,
      personalMedianMl: checked.personalMedianMl, baselineCount: checked.baselineCount,
      personalRuleEvaluated: checked.personalRuleEvaluated, matchedRules: checked.matchedRules };
    const finishedAt = now();
    if (!validClock(finishedAt)) return { status: 'invalid_request' };
    if (token) {
      // Reads can take time; check expiry again before granting permission or issuing B.
      const verified = checkWeightFlowChallenge(request, { appBuildId, nowMs: finishedAt, secret, allowLegacy });
      if (verified.status !== 'valid') return verified;
    }
    if (operation === 'confirm_remeasurement') return { status: 'save_allowed_after_confirmation', ...details };
    if (checked.status === 'ok') return { status: 'save_allowed', ...details };
    if (isBottleExchange) throw new TypeError('Exchange must be exempt in trusted precheck');

    const stage = operation === 'initial' ? 'remeasure' : 'confirm';
    const flowExpiresAt = token ? Math.min(token.flowExpiresAt ?? token.expiresAt, token.expiresAt)
      : finishedAt + WEIGHT_CHALLENGE_POLICY.remeasureTtlMs;
    const issued = issueWeightChallenge({
      stage, staffId, previousWeight: checked.previousWeight, weightNow: current, currentMl,
      appBuildId, ruleVersion: WEIGHT_REMEASUREMENT_RULE_VERSION, flowExpiresAt,
      matchedRules: checked.matchedRules, personalMedianMl: checked.personalMedianMl,
      baselineCount: checked.baselineCount, personalRuleEvaluated: checked.personalRuleEvaluated,
      // B inherits the VERIFIED A ID, never an unchecked replacement from the request.
      ...(token ? (token.operationId === undefined ? {} : { operationId: token.operationId })
        : (operationId === undefined ? {} : { operationId })),
    }, { nowMs: finishedAt, secret, allowLegacy });
    return { status: stage === 'remeasure' ? 'remeasurement_required' : 'confirmation_required', ...details, challenge: issued };
  } catch (error) {
    if (error instanceof WeightChallengeError) return { status: challengeStatuses[error.code] ?? 'challenge_invalid' };
    throw error;
  }
}
