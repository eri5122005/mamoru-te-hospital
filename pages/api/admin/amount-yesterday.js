import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    // 昨日の開始（00:00:00）
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

    // 昨日の終了（23:59:59）
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 23, 59, 59);

    // 昨日の記録だけ取得（高速）
    const q = query(
      collection(db, "records"),
      where("date", ">=", start),
      where("date", "<=", end)
    );

    const recordSnap = await getDocs(q);
    const records = recordSnap.docs.map(doc => doc.data());

    // staffId ごとに ml を合計
    const map = {};

    records.forEach(r => {
      const id = r.staffId;
      const ml = Number(r.ml) || 0;

      if (!map[id]) map[id] = 0;
      map[id] += ml;
    });

    // staff 情報と合体
    const result = staffList.map(s => ({
      staffId: s.staffId,
      name: s.name,
      total: map[s.staffId] || 0,
    }));

    return res.status(200).json(result);

  } catch (error) {
    console.error("amount-yesterday error:", error);
    return res.status(500).json({ error: "Failed to load amount yesterday" });
  }
}
