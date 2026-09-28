import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

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
    // 病棟名マップ（正式名称）
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

    // 今日の日付から「今月」を作る
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0 = Jan

    // 今月の開始
    const start = new Date(year, month, 1);

    // 来月の開始（< で比較するため）
    const end = new Date(year, month + 1, 1);

    // ★ 今月の記録だけ Firestore 側で絞り込む（高速）
    const q = query(
      collection(db, "records"),
      where("date", ">=", start),
      where("date", "<", end)
    );

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => doc.data());

    // 病棟ごとに使用量を集計
    const wardMap = {};

    records.forEach(r => {
      const ward = r.wardId || "不明";

      // ★ Number → normalizeMl に変更
      const ml = normalizeMl(r.ml);

      if (!wardMap[ward]) wardMap[ward] = 0;
      wardMap[ward] += ml;
    });

    // ランキング形式に変換
    const ranking = Object.entries(wardMap)
      .map(([ward, total]) => ({
        wardId: ward,
        wardName: wardNameMap[ward] || ward,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    return res.status(200).json(ranking);

  } catch (error) {
    console.error("ranking-month error:", error);
    return res.status(500).json({ error: "Failed to load monthly ranking" });
  }
}
