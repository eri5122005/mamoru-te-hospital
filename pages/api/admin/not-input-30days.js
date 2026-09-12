import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    // 今日の日付
    const today = new Date();

    // 30日前の日付
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);

    // records 全件取得
    const recordSnap = await getDocs(collection(db, "records"));
    const records = recordSnap.docs.map(doc => doc.data());

    // "2026-09-11" → Date に変換する関数
    const toDate = (str) => {
      const [y, m, d] = str.split("-");
      return new Date(Number(y), Number(m) - 1, Number(d));
    };

    // 30日以内に入力した staffId をセット化
    const usedSet = new Set(
      records
        .filter(r => {
          if (!r.date) return false;
          const recordDate = toDate(r.date);
          return recordDate >= monthAgo && recordDate <= today;
        })
        .map(r => r.staffId)
    );

    // 30日以上未入力者を抽出
    const notInput = staffList.filter(s => !usedSet.has(s.staffId));

    return res.status(200).json(notInput);

  } catch (error) {
    console.error("not-input-30days error:", error);
    return res.status(500).json({ error: "Failed to load not input 30days" });
  }
}
