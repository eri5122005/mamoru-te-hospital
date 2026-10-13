export function getRecordDate(value) {
  try {
    const date = value instanceof Date
      ? value
      : value && typeof value.toDate === "function"
        ? value.toDate()
        : typeof value === "string" && value.trim()
          ? new Date(value)
          : null;
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}
