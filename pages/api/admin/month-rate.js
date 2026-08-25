import { db } from "../../../firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffCount = staffSnap.size;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const recordSnap = await getDocs(
      query(collection(db, "records"), where("date", ">=", monthStart))
    );

    // ★ 重複なしのスタッフ数
    const usedStaffIds = new Set(
      recordSnap.docs.map(doc => doc.data().staffId)
    );
    const usedCount = usedStaffIds.size;

    const rate =
      staffCount === 0 ? 0 : Math.round((usedCount / staffCount) * 100);

    res.status(200).json({ rate });

  } catch (error) {
    console.error("month-rate error:", error);
    res.status(500).json({ error: "Failed to load month rate" });
  }
}
