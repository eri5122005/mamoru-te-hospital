import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

// ★ normalizeMl をここに貼る（このままコピペOK）
function normalizeMl(value) {
  const ml = Number(value);

  if (isNaN(ml)) return 0;      // 数字に変換できない → 0
  if (ml < 0.1) return 0;       // 異常に小さい値 → 0
  if (ml > 1000) return 0;      // 異常に大きい値 → 0
  if (!Number.isFinite(ml)) return 0; // 無限大など → 0

  return ml; // 正常値
}

export default async function handler(req, res) {
  try {
    const wardNameMap = {
      "4f": "4階",
      "5f": "5階",
      "6f": "6階",
      "78f": "7.8階",
      "gairai": "外来",
      "touseki": "透析室",
      "ikyoku": "医局",
      "riha": "リハビリ",
      "shisetsu": "施設管理"
    };

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    const snapshot = await getDocs(collection(db, "records"));
    const records = snapshot.docs.map(doc => doc.data());

    const filtered = records.filter(r => {
      if (!r.date) return false;

      const recordDate = r.date.toDate();
      return recordDate >= weekAgo && recordDate <= today;
    });

    const wardMap = {};

    filtered.forEach(r => {
      const ward = r.wardId || "不明";

      // ★ Number → normalizeMl に変更
      const ml = normalizeMl(r.ml);

      if (!wardMap[ward]) wardMap[ward] = 0;
      wardMap[ward] += ml;
    });

    const ranking = Object.entries(wardMap)
      .map(([ward, total]) => ({
        wardId: ward,
        wardName: wardNameMap[ward] || ward,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    return res.status(200).json(ranking);

  } catch (error) {
    console.error("ranking-week error:", error);
    return res.status(500).json({ error: "Failed to load weekly ranking" });
  }
}
 