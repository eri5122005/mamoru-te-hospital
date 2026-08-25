import { db } from "../../../firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 全スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map(doc => ({
      staffId: doc.id,
      ...doc.data(),
    }));

    // 今月の開始日
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 今月の記録
    const recordSnap = await getDocs(
      query(collection(db, "records"), where("date", ">=", monthStart))
    );

    const recordedIds = recordSnap.docs.map(doc => doc.data().staffId);

    // 未入力者
    const notEntered = staffList.filter(
      s => !recordedIds.includes(s.staffId)
    );

    res.status(200).json({
      count: notEntered.length,
      notEntered,
    });

  } catch (error) {
    console.error("month-not-entered-count error:", error);
    res.status(500).json({ error: "Failed to load month not entered count" });
  }
}
