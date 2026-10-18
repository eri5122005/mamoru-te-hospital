import { isActiveStaff } from "@/utils/isActiveStaff";
import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const wardNameMap = {
    "nursing": "看護部",
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
    const staffList = staffSnap.docs.map(doc => doc.data()).filter(isActiveStaff);

    // 今日の開始・終了
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // ★ Timestamp の範囲検索に修正
    const recordSnap = await getDocs(
      query(
        collection(db, "records"),
        where("date", ">=", start),
        where("date", "<=", end)
      )
    );

    const records = recordSnap.docs.map(doc => doc.data());

    const wardActiveIds = {};
    staffList.forEach(s => {
      const ward = s.wardId;
      if (!wardActiveIds[ward]) wardActiveIds[ward] = new Set();
      wardActiveIds[ward].add(s.staffId);
    });
    const wardEnteredIds = {};
    records.forEach(r => {
      const ward = r.wardId;
      if (!wardActiveIds[ward]?.has(r.staffId)) return;
      if (!wardEnteredIds[ward]) wardEnteredIds[ward] = new Set();
      wardEnteredIds[ward].add(r.staffId);
    });

    // 入力率計算
    const wardRate = Object.keys(wardActiveIds).map(ward => {
      const total = wardActiveIds[ward].size;
      const used = wardEnteredIds[ward]?.size || 0;
      const rate = total === 0 ? 0 : Math.round((used / total) * 100);

      return {
        wardId: ward,
        wardName: wardNameMap[ward] || ward,
        totalCount: total,
        usedCount: used,
        rate,
      };
    });

    return res.status(200).json(wardRate);

  } catch (error) {
    console.error("ward-rate error:", error);
    return res.status(500).json({ error: "Failed to load ward rate" });
  }
}
