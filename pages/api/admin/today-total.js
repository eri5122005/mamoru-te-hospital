import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // ★ JST 今日の 00:00 と 23:59 を作る
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const snapshot = await getDocs(collection(db, "records"));

    let total = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const recordDate = data.date.toDate(); // Firestore Timestamp → JS Date

      // ★ JST の今日の範囲に入っているか判定
      if (recordDate >= start && recordDate <= end) {
        total += Number(data.ml) || 0;
      }
    });

    // ★ 小数点誤差を完全に消す
    res.status(200).json({ total: Number(total.toFixed(2)) });

  } catch (error) {
    console.error("today-total error:", error);
    res.status(500).json({ total: 0 });
  }
}
