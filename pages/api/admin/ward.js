import { db } from "../../../firebaseConfig";

import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

// ★ ここに normalizeMl を貼る（このままコピペOK）
function normalizeMl(value) {
  const ml = Number(value);

  if (isNaN(ml)) return 0;      // 数字に変換できない → 0
  if (ml < 0.1) return 0;       // 異常に小さい値 → 0
  if (ml > 1000) return 0;      // 異常に大きい値 → 0
  if (!Number.isFinite(ml)) return 0; // 無限大など → 0

  return ml; // 正常値
}

export default async function handler(req, res) {
  const { id } = req.query; // wardId

  try {
    // ① 病棟スタッフ一覧
    const staffQuery = query(
      collection(db, "staff"),
      where("wardId", "==", id)
    );
    const staffSnap = await getDocs(staffQuery);

    const staffList = staffSnap.docs.map((doc) => ({
      staffId: doc.id,
      ...doc.data(),
    }));

    // ② 今日の開始・終了
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // ③ 今日の記録（病棟IDで絞る）
    const recordQuery = query(
      collection(db, "records"),
      where("wardId", "==", id),
      where("date", ">=", start),
      where("date", "<=", end)
    );
    const recordSnap = await getDocs(recordQuery);

    const todayRecords = recordSnap.docs.map((doc) => ({
      recordId: doc.id,
      ...doc.data(),
    }));

    // ④ 病棟スタッフの記録だけに絞る
    const wardRecords = todayRecords.filter((r) =>
      staffList.some((s) => s.staffId === r.staffId)
    );

    // ⑤ 未入力者
    const recordedStaffIds = wardRecords.map((r) => r.staffId);
    const notEntered = staffList.filter(
      (s) => !recordedStaffIds.includes(s.staffId)
    );

    // ⑥ 病棟の合計使用量（★ normalizeMl に変更）
    const totalMl = wardRecords.reduce(
      (sum, r) => sum + normalizeMl(r.ml),
      0
    );

    return res.status(200).json({
      staff: staffList,
      records: wardRecords,
      notEntered,
      totalMl,
    });
  } catch (error) {
    console.error("admin ward API error:", error);
    return res.status(500).json({ error: "Failed to load admin ward data" });
  }
}
