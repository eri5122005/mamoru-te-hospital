import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const mode = req.query.mode || "week"; // week / month / year

    const snapshot = await getDocs(collection(db, "records"));
    const records = snapshot.docs.map(doc => doc.data());

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

    const now = new Date();

    // 週の開始（月曜）
    const startOfWeek = new Date(now);
    const day = now.getDay(); // 0=日曜
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(now.getDate() + diff);

    // 期間フィルタ
    const filtered = records.filter(r => {
      const t = r.date.toDate();
      const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);

      if (mode === "week") {
        return jst >= startOfWeek && jst <= now;
      }
      if (mode === "month") {
        return (
          jst.getFullYear() === now.getFullYear() &&
          jst.getMonth() === now.getMonth()
        );
      }
      if (mode === "year") {
        return jst.getFullYear() === now.getFullYear();
      }
      return true;
    });

    const wardMap = {};

    filtered.forEach(r => {
      const ward = r.wardId || "不明";
      const ml = Number(r.ml) || 0;

      if (!wardMap[ward]) wardMap[ward] = 0;
      wardMap[ward] += ml;
    });

    const ranking = Object.entries(wardMap)
      .map(([ward, total]) => ({
        wardName: wardNameMap[ward] || ward,
        total,
      }))
      .sort((a, b) => b.total - a.total);

    return res.status(200).json(ranking);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load ranking" });
  }
}
