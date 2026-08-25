import { db } from "../../../firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 病棟一覧
    const wardSnap = await getDocs(collection(db, "ward"));
    const wardList = wardSnap.docs.map(doc => ({
      wardId: doc.id,
      ...doc.data(),
    }));

    // 全スタッフ
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => ({
      staffId: doc.id,
      ...doc.data(),
    }));

    // 病棟ごとのスタッフ数
    const wardStaffCount = {};
    staffList.forEach(s => {
      if (!wardStaffCount[s.wardId]) wardStaffCount[s.wardId] = 0;
      wardStaffCount[s.wardId]++;
    });

    // 今日の日付
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 今日の記録
    const recordSnap = await getDocs(
      query(collection(db, "records"), where("date", ">=", today))
    );

    const records = recordSnap.docs.map(doc => doc.data());

    // 病棟ごとの入力者数
    const wardUsedCount = {};
    records.forEach(r => {
      if (!wardUsedCount[r.wardId]) wardUsedCount[r.wardId] = 0;
      wardUsedCount[r.wardId]++;
    });

    // 入力率＋病棟名
    const wardRate = Object.keys(wardStaffCount).map(wardId => {
      const total = wardStaffCount[wardId];
      const used = wardUsedCount[wardId] || 0;
      const rate = total === 0 ? 0 : Math.round((used / total) * 100);

      const ward = wardList.find(w => w.wardId === wardId);

      return {
        wardId,
        name: ward?.name || wardId,   // ★ 病棟名を付ける
        rate,
      };
    });

    res.status(200).json(wardRate);

  } catch (error) {
    console.error("ward-rate error:", error);
    res.status(500).json({ error: "Failed to load ward rate" });
  }
}
