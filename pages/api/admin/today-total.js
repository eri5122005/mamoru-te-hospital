import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";

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
    const now = new Date();

    // 今日の開始（JST）
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // 今日の終了（JST）
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // ★ Firestore は UTC なので Timestamp に変換する
    const q = query(
  collection(db, "records"),
  where("date", ">=", Timestamp.fromDate(start)),
  where("date", "<=", Timestamp.fromDate(end))
);

    const snapshot = await getDocs(q);

    let total = 0;
    snapshot.forEach(doc => {
      total += normalizeMl(doc.data().ml);
    });

    res.status(200).json({ total });
  } catch (error) {
    console.error("today-total error:", error);
    res.status(500).json({ total: 0 });
  }
}
