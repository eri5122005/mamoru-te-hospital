import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // ★ 新しい正式名称に統一
    const wardNameMap = {
      "4f": "4階",
      "5f": "5階",
      "6f": "6階",
      "78f": "7.8階",
      "gairai": "外来",
      "touseki": "透析室",
      "ikyoku": "医局",
      "riha": "リハビリ",
    };

    // ★ staff.department ではなく wardId を使う
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    const wardStaffCount = {};
    staffList.forEach(s => {
      const ward = s.wardId;   // ★ 修正ポイント
      if (!wardStaffCount[ward]) wardStaffCount[ward] = 0;
      wardStaffCount[ward]++;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recordSnap = await getDocs(
      query(collection(db, "records"), where("date", ">=", today))
    );
    const records = recordSnap.docs.map(doc => doc.data());

    const wardUsedCount = {};
    records.forEach(r => {
      const ward = r.wardId;   // ★ 修正ポイント

      if (!ward) return;

      if (!wardUsedCount[ward]) wardUsedCount[ward] = 0;
      wardUsedCount[ward]++;
    });

    const wardRate = Object.keys(wardStaffCount).map(ward => {
      const total = wardStaffCount[ward];
      const used = wardUsedCount[ward] || 0;
      const rate = total === 0 ? 0 : Math.round((used / total) * 100);

      return {
        wardName: wardNameMap[ward] || ward,
        rate,
      };
    });

    res.status(200).json(wardRate);

  } catch (error) {
    console.error("ward-rate error:", error);
    res.status(500).json({ error: "Failed to load ward rate" });
  }
}
