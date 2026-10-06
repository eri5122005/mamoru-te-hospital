// force rebuild
export const revalidate = 0;

import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // JST 現在時刻
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    // 今日の 0:00 と 23:59（JST）
    const start = new Date(
      jstNow.getFullYear(),
      jstNow.getMonth(),
      jstNow.getDate(),
      0, 0, 0
    );

    const end = new Date(
      jstNow.getFullYear(),
      jstNow.getMonth(),
      jstNow.getDate(),
      23, 59, 59
    );

    // ★ records を読む
    const snapshot = await getDocs(collection(db, "records"));

    let total = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.date) return;

      const d = data.date.toDate(); // Timestamp → Date

      if (d >= start && d <= end) {
        total += Number(data.ml) || 0;
      }
    });

    res.status(200).json({ total: Number(total.toFixed(2)) });

  } catch (error) {
    console.error("today-total error:", error);
    res.status(500).json({ total: 0 });
  }
}
