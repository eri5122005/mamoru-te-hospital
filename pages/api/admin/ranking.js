import { db } from "../../../firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 病棟一覧（名前を取得）
    const wardSnap = await getDocs(collection(db, "ward"));
    const wardList = wardSnap.docs.map(doc => ({
      wardId: doc.id,
      ...doc.data(),
    }));

    // 今日の日付
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 今日の記録
    const recordSnap = await getDocs(
      query(collection(db, "records"), where("date", ">=", today))
    );

    const records = recordSnap.docs.map(doc => doc.data());

    // 病棟別合計
    const wardTotals = {};

    records.forEach(r => {
      const wardId = r.wardId;
      if (!wardTotals[wardId]) wardTotals[wardId] = 0;
      wardTotals[wardId] += Number(r.ml);
    });

    // 病棟名を付けてランキング化
    const ranking = Object.entries(wardTotals)
      .map(([wardId, totalMl]) => {
        const ward = wardList.find(w => w.wardId === wardId);
        return {
          wardId,
          name: ward?.name || wardId,   // ★ 病棟名を付ける
          totalMl,
        };
      })
      .sort((a, b) => b.totalMl - a.totalMl);

    res.status(200).json(ranking);

  } catch (error) {
    console.error("ranking error:", error);
    res.status(500).json({ error: "Failed to load ranking" });
  }
}
