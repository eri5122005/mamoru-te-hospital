import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const snapshot = await getDocs(collection(db, "records"));
    const records = snapshot.docs.map(doc => doc.data());

    // ★ あなたの病棟名セット（正式名称）
   const wardNameMap = {
  "4f": "4階",
  "5f": "5階",
  "6f": "6階",
  "78f": "7.8階",
  "gairai": "外来",
  "touseki": "透析室",
  "ikyoku": "医局",
  "riha": "リハビリ",   // ★ reha → riha に修正
  "shisetsu": "施設管理"   // ★ 追加
};


    const wardMap = {};

    records.forEach(r => {
      const ward = r.wardId || "不明";   // ★ department → wardId に修正
      const ml = Number(r.ml) || 0;

      if (!wardMap[ward]) wardMap[ward] = 0;
      wardMap[ward] += ml;
    });

    const ranking = Object.entries(wardMap)
      .map(([ward, total]) => ({
        wardName: wardNameMap[ward] || ward,  // ★ 正式名称に変換
        total,
      }))
      .sort((a, b) => b.total - a.total);

    return res.status(200).json(ranking);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load ranking" });
  }
}
