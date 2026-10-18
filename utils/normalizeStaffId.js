export function normalizeStaffId(value) {
  return String(value ?? "")
    .trim()
    .replace(/[０-９]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xFEE0)
    );
}
