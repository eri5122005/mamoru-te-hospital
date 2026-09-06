import { db } from "../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const wardNameMap = {
      "4f": "4階病棟",
      "5f": "5階病棟",
      "6f": "6階病棟",
      "78f": "7.8階病棟",
      "gairai": "外来",
      "touseki": "透析室",
      "ikyoku": "医局",
      "reha": "リハビリ",
    };

    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => doc.data());

    const wardStaffCount = {};
    staffList.forEach(s => {
      const ward = s.department;
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
      console.log("WARD ID:", r.wardId);

      const ward = wardNameMap[r.wardId];

      if (!ward) {
        console.log("未対応 wardId:", r.wardId);
        return;
      }

      if (!wardUsedCount[ward]) wardUsedCount[ward] = 0;
      wardUsedCount[ward]++;
    });

    const wardRate = Object.keys(wardStaffCount).map(ward => {
      const total = wardStaffCount[ward];
      const used = wardUsedCount[ward] || 0;
      const rate = total === 0 ? 0 : Math.round((used / total) * 100);

      return { wardName: ward, rate };
    });

    res.status(200).json(wardRate);

  } catch (error) {
    console.error("ward-rate error:", error);
    res.status(500).json({ error: "Failed to load ward rate" });
  }
}
