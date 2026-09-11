import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

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

    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    const wardStaffCount = {};
    staffList.forEach(s => {
      const ward = s.wardId;
      if (!wardStaffCount[ward]) wardStaffCount[ward] = 0;
      wardStaffCount[ward]++;
    });

    // 今日の日付（文字列）
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;

    // 今日の記録
    const recordSnap = await getDocs(
      query(collection(db, "records"), where("date", "==", todayStr))
    );
    const records = recordSnap.docs.map(doc => doc.data());

    const wardUsedCount = {};
    records.forEach(r => {
      const ward = r.wardId;
      if (!ward) return;
      if (!wardUsedCount[ward]) wardUsedCount[ward] = 0;
      wardUsedCount[ward]++;
    });

    // 入力率計算
    const wardRate = Object.keys(wardStaffCount).map(ward => {
      const total = wardStaffCount[ward];
      const used = wardUsedCount[ward] || 0;
      const rate = total === 0 ? 0 : Math.round((used / total) * 100);

      return {
        wardId: ward,
        wardName: wardNameMap[ward] || ward,
        totalCount: total,
        usedCount: used,
        rate,
      };
    });

    res.status(200).json(wardRate);

  } catch (error) {
    console.error("ward-rate error:", error);
    res.status(500).json({ error: "Failed to load ward rate" });
  }
}
