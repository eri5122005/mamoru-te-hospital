import { normalizeStaffId } from "./normalizeStaffId";
import { isActiveStaff } from "./isActiveStaff";
import { readRecordDraft, clearRecordDraft } from "./recordUpdateDraft";

export function currentRecordStaffId(storage) {
  const local = JSON.parse(storage.getItem("currentStaff") || "null");
  return typeof local?.staffId === "string" ? normalizeStaffId(local.staffId) : "";
}
export async function loadRecordContext({ readCurrentId, storage, checkVersion, fetchStaff, isCurrent = () => true }) {
  const id = readCurrentId();
  if (!id) throw new Error("ログイン情報を確認できません。ログインし直してください。");
  let draft;
  try { draft = readRecordDraft(storage, id); }
  catch { throw new Error("一時入力を確認できません。記録せず、管理者に確認してください。"); }
  const version = await checkVersion();
  if (version.status !== "current") {
    const error = new Error("最新版を確認できませんでした。通信状態を確認して、もう一度お試しください。");
    error.updateRequired = version.status === "update-required";
    throw error;
  }
  const latest = await fetchStaff(id);
  if (readCurrentId() !== id) throw new Error("ログイン中の職員が変わりました。ログインし直してください。");
  if (!latest || Array.isArray(latest) || latest.staffId !== id || !isActiveStaff(latest) || latest.mode !== "weight") {
    throw new Error("最新の職員情報を確認できません。ログインし直すか、管理者に確認してください。");
  }
  const raw = latest.lastWeight;
  const weight = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
  if (!Number.isFinite(weight) || weight < 45 || weight > 263) {
    throw new Error("前回の重量が正しく設定されていません。管理者に確認してください。");
  }
  if (!isCurrent()) throw new Error("画面が切り替わったため処理を中止しました。");
  // Recheck both identity and the draft against the current clock after all awaits.
  if (readCurrentId() !== id) throw new Error("ログイン中の職員が変わりました。ログインし直してください。");
  try { draft = readRecordDraft(storage, id); }
  catch { throw new Error("一時入力を安全に復元できません。記録せず、管理者に確認してください。"); }
  // Consume before making the screen ready. Storage failure must not enable records.
  if (draft) {
    try { clearRecordDraft(storage, id); }
    catch { throw new Error("一時入力を安全に復元できません。記録せず、管理者に確認してください。"); }
  }
  return { staff: { ...latest, staffId: id, lastWeight: weight }, weightNow: draft?.weightNow ?? "" };
}
