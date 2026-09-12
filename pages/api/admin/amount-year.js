import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    // 今日の日付から「今年」を作る
    const today = new Date();
    const year = today.getFullYear();

    // 今年の prefix（例：2026-）
    const yearPrefix = `${year}-`;

    // records 全件取得
    const recordSnap = await getDocs(collection(db, "records"));
    const records = recordSnap.docs.map(doc => doc.data());

    // staffId ごとに ml を合計
    const map = {};

    records.forEach(r => {
      if (!r.date) return;

      if (r.date.startsWith(yearPrefix)) {
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
      total: map[s.staffId] || 0,
    }));

    return res.status(200).json(result);

  } catch (error) {
    console.error("amount-year error:", error);
    return res.status(500).json({ error: "Failed to load amount year" });
  }
}
