import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth(); // 0 = January

    const snapshot = await getDocs(collection(db, "records"));

    let total = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const d = data.date.toDate();

      // 今月の記録だけ合計する（mL）
      if (d.getFullYear() === thisYear && d.getMonth() === thisMonth) {
        total += data.ml || 0;
      }
    });

    res.status(200).json({ total });
  } catch (error) {
    console.error("month-total error:", error);
    res.status(500).json({ total: 0 });
  }
}
