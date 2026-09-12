import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    // 今日の日付（文字列）
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    // 今日の記録
    const recordSnap = await getDocs(
      query(collection(db, "records"), where("date", "==", todayStr))
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
