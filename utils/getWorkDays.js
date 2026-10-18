// Normalize registered monthly work days; arrays and other non-scalar values are invalid.
export function getWorkDays(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const days = Number(value);
  return Number.isInteger(days) && days > 0 ? days : null;
}
