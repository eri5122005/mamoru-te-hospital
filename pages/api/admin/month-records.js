import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const { wardId, month } = req.query; // "2026-09"

    if (!wardId || !month) {
      return res.status(400).json({ error: "wardId and month are required" });
    }

    // 月の開始と終了
    const start = new Date(`${month}-01`);
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);

    // 病棟スタッフ一覧（doc.data().staffId を使う）
    const staffQ = query(
      collection(db, "staff"),
      where("wardId", "==", wardId)
    );
    const staffSnap = await getDocs(staffQ);

    const staff = staffSnap.docs.map(doc => doc.data());
    const staffIds = staff.map(s => s.staffId);

    // 月の記録だけ取得（高速）
    const recordQ = query(
      collection(db, "records"),
      where("date", ">=", start),
      where("date", "<", end)
    );
    const recordSnap = await getDocs(recordQ);

    const records = recordSnap.docs
      .map(doc => ({ recordId: doc.id, ...doc.data() }))
      .filter(r => staffIds.includes(r.staffId));

    // 院内合計
    const totalMl = records.reduce((sum, r) => sum + Number(r.ml), 0);

    // スタッフ別集計
    const staffStats = staff.map(s => {
      const myRecords = records.filter(r => r.staffId === s.staffId);
      const myTotal = myRecords.reduce((sum, r) => sum + Number(r.ml), 0);

      return {
        staffId: s.staffId,
        name: s.name,
        totalMl: myTotal,
        count: myRecords.length,
      };
    });

    return res.status(200).json({
      staff,
      records,
      totalMl,
      staffStats,
    });

  } catch (error) {
    console.error("month records error:", error);
    return res.status(500).json({ error: "Failed to load month records" });
  }
}
