import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

// ★ normalizeMl（あなたの環境のままでOK）
function normalizeMl(value) {
  const ml = Number(value);
  if (isNaN(ml)) return 0;
  if (ml < 0.1) return 0;
  if (ml > 1000) return 0;
  if (!Number.isFinite(ml)) return 0;
  return ml;
}

export default async function handler(req, res) {
  const { staffId } = req.query;

  try {
    const now = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // ★ ここが最重要：カンマ必須
    const q = query(
  collection(db, "records"),
  where("staffId", "==", staffId),   // ★ 文字列で検索
  where("date", ">=", monthStart),
  where("date", "<", monthEnd)
);

    const snap = await getDocs(q);

    let total = 0;
    snap.forEach(doc => {
      total += normalizeMl(doc.data().ml);
    });

    return res.status(200).json({ total });

  } catch (error) {
    console.error("staff-month error:", error);
    return res.status(500).json({ total: 0 });
  }
}
