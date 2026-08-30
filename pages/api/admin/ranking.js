import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const snapshot = await getDocs(collection(db, "records"));
    const records = snapshot.docs.map(doc => doc.data());

    const wardMap = {};

    records.forEach(r => {
      const ward = r.department || "不明";
      const ml = Number(r.ml) || 0;

      if (!wardMap[ward]) wardMap[ward] = 0;
      wardMap[ward] += ml;
    });

    const ranking = Object.entries(wardMap)
      .map(([name, total]) => ({ name, total }))   // ★ totalMl → total に変更
      .sort((a, b) => b.total - a.total);

    return res.status(200).json(ranking);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load ranking" });
  }
}
