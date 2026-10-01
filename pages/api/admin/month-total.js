import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 現在日時（JST）
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();

// JST の月初（そのままでOK）
const start = new Date(year, month, 1, 0, 0, 0);

// JST の来月月初（そのままでOK）
const end = new Date(year, month + 1, 1, 0, 0, 0);

// ★ Firestore は JST のまま比較してよい
const q = query(
  collection(db, "records"),
  where("date", ">=", start),
  where("date", "<", end)
);

    const snapshot = await getDocs(q);

    let total = 0;
    snapshot.forEach(doc => {
      total += Number(doc.data().ml) || 0;
    });

    res.status(200).json({ total });

  } catch (error) {
    console.error("month-total error:", error);
    res.status(500).json({ total: 0 });
  }
}
