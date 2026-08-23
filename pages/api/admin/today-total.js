import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const now = new Date();

    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // Firestore の usage コレクションから今日の記録を取得
    const q = query(
      collection(db, "usage"),
      where("year", "==", year),
      where("month", "==", month),
      where("day", "==", day)
    );

    const snapshot = await getDocs(q);

    // 今日の使用量（記録件数）
    const total = snapshot.size;

    res.status(200).json({ total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
