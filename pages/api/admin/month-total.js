import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth(); // 0 = January

    // 今月の開始
    const start = new Date(thisYear, thisMonth, 1);

    // 来月の開始（< で比較するため）
    const end = new Date(thisYear, thisMonth + 1, 1);

    // ★ 今月の記録だけ Firestore 側で絞り込む（高速）
    const q = query(
      collection(db, "records"),
      where("date", ">=", start),
      where("date", "<", end)
    );

    const snapshot = await getDocs(q);

    let total = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      total += Number(data.ml) || 0;
    });

    res.status(200).json({ total });
  } catch (error) {
    console.error("month-total error:", error);
    res.status(500).json({ total: 0 });
  }
}
