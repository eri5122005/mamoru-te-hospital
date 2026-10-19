import { normalizeStaffId } from "./normalizeStaffId";

export const RECORD_DRAFT_KEY = "mamoru-te:record-update-draft:v1";
export const RECORD_DRAFT_TTL = 30 * 60 * 1000;
export function validCurrentWeight(value) {
  return typeof value === "string" && value.trim() !== "" &&
    Number.isFinite(Number(value)) && Number(value) > 45 && Number(value) <= 263;
}
export function readRecordDraft(storage, staffId, now = Date.now()) {
  const raw = storage.getItem(RECORD_DRAFT_KEY);
  if (raw === null) return null;
  let draft;
  try { draft = JSON.parse(raw); } catch { /* Invalid drafts are removed below. */ }
  const id = typeof staffId === "string" ? normalizeStaffId(staffId) : "";
  if (!draft || Array.isArray(draft) || typeof draft !== "object" ||
      Object.keys(draft).sort().join(",") !== "savedAt,staffId,weightNow" ||
      typeof draft.staffId !== "string" || draft.staffId !== id || !id ||
      !validCurrentWeight(draft.weightNow) || !Number.isSafeInteger(draft.savedAt) ||
      draft.savedAt <= 0 || draft.savedAt > now || now - draft.savedAt > RECORD_DRAFT_TTL) {
    storage.removeItem(RECORD_DRAFT_KEY);
    return null;
  }
  return draft;
}
export function saveRecordDraft(storage, staffId, weightNow, now = Date.now()) {
  const id = typeof staffId === "string" ? normalizeStaffId(staffId) : "";
  if (!id || !validCurrentWeight(weightNow)) {
    storage.removeItem(RECORD_DRAFT_KEY);
    return false;
  }
  // Never spread staff, request bodies, or API responses into a draft.
  storage.setItem(RECORD_DRAFT_KEY, JSON.stringify({ staffId: id, weightNow, savedAt: now }));
  return true;
}
export function clearRecordDraft(storage, staffId) {
  if (staffId === undefined) { storage.removeItem(RECORD_DRAFT_KEY); return; }
  const raw = storage.getItem(RECORD_DRAFT_KEY);
  if (raw === null) return;
  let value;
  try { value = JSON.parse(raw); } catch { storage.removeItem(RECORD_DRAFT_KEY); return; }
  if (value?.staffId === normalizeStaffId(staffId)) storage.removeItem(RECORD_DRAFT_KEY);
}
