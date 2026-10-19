import { db } from "../firebaseConfig";
import { doc, getDoc, getDocFromServer, runTransaction } from "firebase/firestore";
import { normalizeStaffId } from "./normalizeStaffId";
import { isActiveStaff } from "./isActiveStaff";

const stopped = "この職員番号は現在利用できません。管理者に確認してください。";
const configured = staff => staff.mode === "weight" &&
  staff.lastWeight !== null && staff.lastWeight !== undefined &&
  staff.emptyWeight !== null && staff.emptyWeight !== undefined;

export async function handleStaffWeightSettings(req, res, firstWeight) {
  const reading = firstWeight && req.method === "GET";
  if (!reading && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const input = reading ? req.query : req.body;
  if (typeof input?.staffId !== "string") return res.status(400).json({ error: "職員番号が正しくありません。" });
  const staffId = normalizeStaffId(input.staffId);
  if (!staffId || staffId.includes("/") || staffId === "." || staffId === "..") {
    return res.status(400).json({ error: "職員番号が正しくありません。" });
  }
  const mode = firstWeight ? "weight" : input.mode;
  if (!reading && mode !== "weight" && mode !== "cm") return res.status(400).json({ error: "モードが正しくありません。" });
  try {
    const staffRef = doc(db, "staff", staffId);
    if (reading) res.setHeader("Cache-Control", "no-store");
    const initial = await (reading ? getDocFromServer(staffRef) : getDoc(staffRef));
    if (!initial.exists()) return res.status(404).json({ error: "職員情報が見つかりません。管理者に確認してください。" });
    if (!isActiveStaff(initial.data())) return res.status(403).json({ error: stopped });
    if (reading) return res.status(200).json({ ok: true, staff: { ...initial.data(), staffId } });
    let weight;
    if (!reading && mode === "weight") {
      const value = input.weight;
      weight = typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN;
      if (!Number.isFinite(weight) || weight <= 45 || weight > 263) {
        return res.status(400).json({ error: "重さは45gより大きく263g以下の数値で入力してください。" });
      }
    }
    const result = await runTransaction(db, async transaction => {
      const snap = await transaction.get(staffRef);
      if (!snap.exists()) return { status: 404, error: "職員情報が見つかりません。管理者に確認してください。" };
      const staff = snap.data();
      if (!isActiveStaff(staff)) return { status: 403, error: stopped };
      if (firstWeight && configured(staff)) {
        return { status: 409, error: "初回重量は既に設定されています。再登録せず、ログインし直して最新情報を確認してください。" };
      }
      const backupRef = firstWeight ? doc(db, "staffs", staffId) : null;
      const backup = firstWeight ? await transaction.get(backupRef) : null;
      const changes = mode === "cm" ? { mode } : { mode, lastWeight: weight, emptyWeight: 46 };
      transaction.update(staffRef, changes);
      if (backup?.exists()) transaction.update(backupRef, changes);
      return { status: 200, staff: { staffId, ...changes } };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    return res.status(200).json({ ok: true, staff: result.staff });
  } catch (error) {
    console.error("重量・モード設定エラー:", error);
    return res.status(500).json({ error: "保存結果を確認できませんでした。再登録せず、管理者に確認してください。" });
  }
}
