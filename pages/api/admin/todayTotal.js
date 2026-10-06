// force rebuild
export const revalidate = 0;

import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // Firestore の Timestamp は JST なのでそのまま使う
    const now = new Date();

    // 今日の 0:00（JST）
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0, 0, 0
    );

    // 今日の 23:59:59（JST）
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, 59, 59
    );

    const snapshot = await getDocs(collection(db, "records"));

    let total = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.date) return;

      // Firestore の date は JST なのでそのまま使う
      const jstDate = data.date.toDate();

      if (jstDate >= start && jstDate <= end) {
        total += Number(data.ml) || 0;
      }
    });

    res.status(200).json({ total: Number(total.toFixed(2)) });

  } catch (error) {
    console.error("today-total error:", error);
    res.status(500).json({ total: 0 });
  }
}
