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

    // 今日の日付
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 今日の記録
    const recordQ = query(
      collection(db, "records"),
      where("date", ">=", today)
    );
    const recordSnap = await getDocs(recordQ);

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
    console.error("today-not-entered-count error:", error);
    res.status(500).json({ error: "Failed to load today not entered count" });
  }
}
