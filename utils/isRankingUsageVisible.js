// Keep the original value for sorting/calculation; only test its one-decimal display.
export function isRankingUsageVisible(value) {
  return Number.isFinite(value) && Number(value.toFixed(1)) > 0;
}
