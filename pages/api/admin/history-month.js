import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const { month } = req.query; // 例: "2026-09"

    if (!month) {
      return res.status(400).json({ error: "month query is required (例: 2026-09)" });
    }

    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    // records 全件取得
    const recordSnap = await getDocs(collection(db, "records"));
    const records = recordSnap.docs.map(doc => doc.data());

    const map = {};

    records.forEach(r => {
      if (!r.date) return;

      // ★ Timestamp → JS Date に変換
      let d;
      if (typeof r.date === "string") {
        d = new Date(r.date);
      } else {
        d = r.date.toDate(); // Firestore Timestamp
      }

      // ★ "YYYY-MM" を作る
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const ym = `${y}-${m}`;

      // ★ 月が一致したら加算
      if (ym === month) {
        const id = r.staffId;
        const ml = Number(r.ml) || 0;

        if (!map[id]) map[id] = 0;
        map[id] += ml;
      }
    });

    // staff 情報と合体
    const result = staffList.map(s => ({
      staffId: s.staffId,
      name: s.name,
      wardId: s.wardId,
      total: map[s.staffId] || 0,
    }));

    return res.status(200).json(result);

  } catch (error) {
    console.error("history-month error:", error);
    return res.status(500).json({ error: "Failed to load history month" });
  }
}
