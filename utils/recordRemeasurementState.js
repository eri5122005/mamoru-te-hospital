// Browser-safe, in-memory state only. No persistence or cryptographic verification.
export const idleRemeasurement = () => ({ phase: 'idle', challengeA: null, challengeB: null, initialWeightNow: null, display: null });
export function acceptRemeasurementResponse(previous, response, operation) {
  const initial = response?.code === 'WEIGHT_REMEASUREMENT_REQUIRED';
  const confirmation = response?.code === 'WEIGHT_REMEASUREMENT_CONFIRMATION_REQUIRED';
  if (!initial && !confirmation) return null;
  if ((initial && operation !== 'normal') || (confirmation && (operation !== 'remeasure' || !previous.challengeA)) ||
      typeof response.challenge !== 'string' || !response.challenge || response.challenge.length > 4096 ||
      !Number.isFinite(response.previousWeight) || response.previousWeight < 45 || response.previousWeight > 263 ||
      !Number.isFinite(response.weightNow) || response.weightNow <= 45 || response.weightNow > 263 ||
      !Number.isFinite(response.currentMl) || response.currentMl <= 0 || response.currentMl > 250 ||
      typeof response.personalRuleEvaluated !== 'boolean' ||
      (response.personalRuleEvaluated ? !Number.isFinite(response.personalMedianMl) || response.personalMedianMl <= 0 : response.personalMedianMl !== null) ||
      !Array.isArray(response.matchedRules) || !response.matchedRules.length || response.matchedRules.length > 2 || new Set(response.matchedRules).size !== response.matchedRules.length || response.matchedRules.some(r => r !== 'A' && r !== 'B')) {
    throw new Error('Invalid remeasurement response');
  }
  return {
    phase: initial ? 'remeasure_required' : 'confirmation_required',
    challengeA: initial ? response.challenge : previous.challengeA,
    challengeB: confirmation ? response.challenge : null,
    initialWeightNow: initial ? response.weightNow : previous.initialWeightNow,
    display: { previousWeight: response.previousWeight, weightNow: response.weightNow,
      currentMl: response.currentMl, personalMedianMl: response.personalMedianMl, personalRuleEvaluated: response.personalRuleEvaluated },
  };
}
export function retryRemeasurement(state) {
  return state.challengeA ? { ...state, phase: 'remeasure_required', challengeB: null, display: null } : idleRemeasurement();
}
export function recordFlowRequest(state, weightNow, exchange = false) {
  if (state.phase === 'idle') return { operation: 'normal' };
  if (exchange) throw new Error('Exchange not permitted during remeasurement');
  if (state.phase === 'remeasure_required' && state.challengeA) return { operation: 'remeasure', challenge: state.challengeA };
  if (state.phase === 'confirmation_required' && state.challengeB && Number(weightNow) === state.display?.weightNow) {
    return { operation: 'confirm_remeasurement', challenge: state.challengeB };
  }
  throw new Error('Remeasurement confirmation changed');
}
export function blockConfirmationEnter(event) {
  if (event.key === 'Enter') event.preventDefault();
}
// A late response must not revive a challenge after logout, staff change or unmount.
export function createRecordRequestScope() {
  let generation = 0, active = true;
  return {
    begin: staffId => ({ generation: ++generation, staffId }),
    valid: (ticket, currentStaffId) => active && ticket.generation === generation && ticket.staffId === currentStaffId,
    invalidate: () => { generation++; },
    dispose: () => { generation++; active = false; },
    activate: () => { active = true; },
  };
}
