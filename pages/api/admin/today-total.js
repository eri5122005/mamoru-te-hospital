// force rebuild
export const revalidate = 0;  // ★ Vercel のキャッシュを完全無効化

import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

function normalizeMl(value) {
  const ml = Number(value);
  if (isNaN(ml)) return 0;
  if (ml < 0.1) return 0;
  if (ml > 1000) return 0;
  if (!Number.isFinite(ml)) return 0;
  return ml;
}

export default async function handler(req, res) {
  try {
    // ★ JST 今日の 00:00 と 23:59 を作る
    const now = new Date();

    // ★ JST 今日の 00:00〜23:59 を作る
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // ★ Firestore 全件取得（UTCズレを完全回避）
    const snapshot = await getDocs(collection(db, "records"));

    let total = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const d = data.date.toDate(); // JST として扱われる

      // ★ JST の今日の範囲で判定（院内ランキングと同じ）
      if (d >= start && d <= end) {
        total += normalizeMl(data.ml);
      }
    });
      
    res.status(200).json({ total: Number(total.toFixed(2)) });

  } catch (error) {
    console.error("today-total error:", error);
    res.status(500).json({ total: 0 });
  }
}
