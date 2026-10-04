import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    // 今日の開始（00:00:00）
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 今日の終了（23:59:59）
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // 今日の記録だけ取得（高速）
    const recordSnap = await getDocs(
      query(
        collection(db, "records"),
        where("date", ">=", start),
        where("date", "<=", end)
      )
    );

    const records = recordSnap.docs.map(doc => doc.data());

    // 今日入力した staffId をセット化
    const usedSet = new Set(records.map(r => r.staffId));

    // 未入力者を抽出
    const notInput = staffList.filter(s => !usedSet.has(s.staffId));

    return res.status(200).json(notInput);

  } catch (error) {
    console.error("not-input-today error:", error);
    return res.status(500).json({ error: "Failed to load not input today" });
  }
}
