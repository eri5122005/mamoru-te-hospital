import { calculateWeightUsage } from './calculateWeightUsage.js';

export const WEIGHT_REMEASUREMENT_RULES = Object.freeze({
  historyCount: 3,
  minimumMl: 50,
  medianMultiplier: 2,
  absoluteMl: 150,
  mlTolerance: 0.01,
  floatingPointEpsilon: 1e-9,
});

function finiteNumeric(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function recordTime(value) {
  try {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if (value && typeof value.toDate === 'function') return recordTime(value.toDate());
    const text = typeof value === 'string' ? value : value?.timestamp;
    // Match audit timezone independence; no timezone-less strings or numeric epoch coercion.
    if (typeof text !== 'string' || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text.trim())) return null;
    const t = Date.parse(text);
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}

export function eligibleNormalUsage(record) {
  if (!record || Array.isArray(record) || typeof record !== 'object' ||
      record.unit !== 'weight' || record.isBottleExchange !== false || recordTime(record.date) === null) return null;
  const previous = finiteNumeric(record.weightPrev), current = finiteNumeric(record.weightNow), stored = finiteNumeric(record.ml);
  if (previous === null || previous < 45 || previous > 263 || current === null || current <= 45 || current > 263 ||
      stored === null || stored < 0) return null;
  const ml = calculateWeightUsage(previous, current, false);
  const rules = WEIGHT_REMEASUREMENT_RULES;
  return ml > 0 && Math.abs(stored - ml) <= rules.mlTolerance + rules.floatingPointEpsilon ? ml : null;
}

/**
 * Pure decision only. currentMl must already be server-recalculated/validated, never a trusted client claim.
 * history must be a successfully fetched array for ONE person, projected to non-identifying fields.
 * Missing/failed history is an error, not []. evaluatedAt is supplied explicitly (no hidden clock).
 * No network completeness guarantee: callers must distinguish exhausted history from truncated/failed reads.
 */
export function evaluateWeightRemeasurement({ currentMl, isBottleExchange, history, evaluatedAt } = {}) {
  if (typeof currentMl !== 'number' || !Number.isFinite(currentMl) || currentMl < 0) throw new TypeError('Invalid calculated usage');
  if (typeof isBottleExchange !== 'boolean') throw new TypeError('Invalid exchange flag');
  if (!Array.isArray(history)) throw new TypeError('Successfully fetched history array required');
  const cutoff = recordTime(evaluatedAt);
  if (cutoff === null) throw new TypeError('Valid evaluation date required');
  const dated = history.map(record => ({ record, time: recordTime(record?.date) })).filter(r => r.time !== null && r.time < cutoff);
  const timestampCounts = new Map();
  for (const r of dated) timestampCounts.set(r.time, (timestampCounts.get(r.time) || 0) + 1);
  // Same audit policy: ambiguous timestamp groups never enter a personal baseline.
  const selected = dated.filter(r => timestampCounts.get(r.time) === 1)
    .map(r => ({ time: r.time, ml: eligibleNormalUsage(r.record) })).filter(r => r.ml !== null)
    .sort((a, b) => b.time - a.time).slice(0, WEIGHT_REMEASUREMENT_RULES.historyCount);
  const baselineAvailable = selected.length === WEIGHT_REMEASUREMENT_RULES.historyCount;
  const sorted = selected.map(r => r.ml).sort((a, b) => a - b);
  const personalMedianMl = baselineAvailable ? sorted[Math.floor(sorted.length / 2)] : null;
  const personalRuleEvaluated = !isBottleExchange && baselineAvailable;
  const matchedRules = [];
  if (!isBottleExchange) {
    const rules = WEIGHT_REMEASUREMENT_RULES;
    if (personalRuleEvaluated && currentMl >= rules.minimumMl && currentMl >= personalMedianMl * rules.medianMultiplier) matchedRules.push('A');
    if (currentMl >= rules.absoluteMl) matchedRules.push('B');
  }
  return { requiresRemeasurement: matchedRules.length > 0, matchedRules, currentMl,
    personalMedianMl, baselineCount: selected.length, baselineAvailable, personalRuleEvaluated };
}
