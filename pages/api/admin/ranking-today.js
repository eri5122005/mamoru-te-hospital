import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

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

    // 今日の日付（文字列）
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    // 今日の記録だけ取得
    const snapshot = await getDocs(
      query(collection(db, "records"), where("date", "==", todayStr))
    );
    const records = snapshot.docs.map(doc => doc.data());

    // 病棟ごとに使用量を集計
    const wardMap = {};

    records.forEach(r => {
      const ward = r.wardId || "不明";
      const ml = Number(r.ml) || 0;

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
    console.error("ranking-today error:", error);
    return res.status(500).json({ error: "Failed to load ranking" });
  }
}
