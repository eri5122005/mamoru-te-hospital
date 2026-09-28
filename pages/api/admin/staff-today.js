import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

// ★ ここに normalizeMl を貼る（このままコピペOK）
function normalizeMl(value) {
  const ml = Number(value);

  if (isNaN(ml)) return 0;      // 数字に変換できない → 0
  if (ml < 0.1) return 0;       // 異常に小さい値 → 0
  if (ml > 1000) return 0;      // 異常に大きい値 → 0
  if (!Number.isFinite(ml)) return 0; // 無限大など → 0

  return ml; // 正常値
}

export default async function handler(req, res) {
  const { staffId } = req.query;

  try {
    // 今日の開始（00:00）
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 今日の終了（23:59:59）
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

   const q = query(
  collection(db, "records"),
  where("staffId", "==", staffId),   // ★ 文字列で検索
  where("date", ">=", start),
  where("date", "<=", end)
);

    const snap = await getDocs(q);

    let total = 0;
    snap.forEach(doc => {
      // ★ ここを書き換える（Number → normalizeMl）
      total += normalizeMl(doc.data().ml);
    });

    return res.status(200).json({ total });

  } catch (error) {
    console.error("staff-today error:", error);
    return res.status(500).json({ total: 0 });
  }
}
