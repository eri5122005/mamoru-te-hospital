import { db } from "../../../firebaseConfig";

import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

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

    // ② 今日の記録一覧（★ wardId で絞る）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recordQuery = query(
      collection(db, "records"),
      where("wardId", "==", id),   // ★ 追加：病棟IDで絞る
      where("date", ">=", today)
    );
    const recordSnap = await getDocs(recordQuery);

    const todayRecords = recordSnap.docs.map((doc) => ({
      recordId: doc.id,
      ...doc.data(),
    }));

    // ③ 病棟スタッフの記録だけに絞る（安全のため残す）
    const wardRecords = todayRecords.filter((r) =>
      staffList.some((s) => s.staffId === r.staffId)
    );

    // ④ 未入力者
    const recordedStaffIds = wardRecords.map((r) => r.staffId);
    const notEntered = staffList.filter(
      (s) => !recordedStaffIds.includes(s.staffId)
    );

    // ⑤ 病棟の合計使用量
    const totalMl = wardRecords.reduce((sum, r) => sum + Number(r.ml), 0);

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
