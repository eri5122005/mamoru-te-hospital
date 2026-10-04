import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    // ★ JST 昨日の 00:00 と 23:59 を作る
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

    // ★ records 全件取得（Timestamp を JST で判定するため）
    const recordSnap = await getDocs(collection(db, "records"));
    const records = recordSnap.docs.map(doc => doc.data());

    // staffId ごとに ml を合計
    const map = {};

    records.forEach(r => {
      const recordDate = r.date.toDate(); // Timestamp → JS Date（JSTとして扱える）

      // ★ JST の昨日の範囲に入っているか判定
      if (recordDate >= start && recordDate <= end) {
        const id = r.staffId;
        const ml = Number(r.ml) || 0;

        if (!map[id]) map[id] = 0;
        map[id] += ml;
      }
    });

    // staff 情報と合体
    const result = staffList.map(s => ({
      staffId: s.staffId,
      name: s.name,
      total: Number((map[s.staffId] || 0).toFixed(2)), // ★ 小数点誤差を消す
    }));

    return res.status(200).json(result);

  } catch (error) {
    console.error("amount-yesterday error:", error);
    return res.status(500).json({ error: "Failed to load amount yesterday" });
  }
}
