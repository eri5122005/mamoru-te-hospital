import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    // 昨日の日付（文字列）
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, "0");
    const d = String(yesterday.getDate()).padStart(2, "0");
    const ystr = `${y}-${m}-${d}`;

    // 昨日の記録
    const recordSnap = await getDocs(
      query(collection(db, "records"), where("date", "==", ystr))
    );
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
