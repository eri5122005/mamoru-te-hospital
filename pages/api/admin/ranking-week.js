import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

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

    // 今日の日付
    const today = new Date();

    // 7日前の日付を作る
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    // Firestore の date は "2026-09-11" のような文字列なので
    // records 全件を取得してからフィルタリングする
    const snapshot = await getDocs(collection(db, "records"));
    const records = snapshot.docs.map(doc => doc.data());

    // 文字列の日付を Date に変換する関数
    const toDate = (str) => {
      const [y, m, d] = str.split("-");
      return new Date(Number(y), Number(m) - 1, Number(d));
    };

    // 過去7日間の記録だけに絞る
    const filtered = records.filter(r => {
      if (!r.date) return false;
      const recordDate = toDate(r.date);
      return recordDate >= weekAgo && recordDate <= today;
    });

    // 病棟ごとに使用量を集計
    const wardMap = {};

    filtered.forEach(r => {
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
    console.error("ranking-week error:", error);
    return res.status(500).json({ error: "Failed to load weekly ranking" });
  }
}
