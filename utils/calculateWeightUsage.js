// Inputs are validated weights in grams. Keep the existing record-page formulas.
export function calculateWeightUsage(previousWeight, currentWeight, exchange = false) {
  let ml = exchange
    ? ((previousWeight - 45) + (263 - currentWeight)) * (250 / 218)
    : (previousWeight - currentWeight) * (250 / (263 - 45));
  if (ml < 0) ml = 0;
  if (!exchange && ml < 0.01) ml = 0;
  return Number(ml.toFixed(2));
}
