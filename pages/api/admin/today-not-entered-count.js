import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 今日の日付（YYYY-MM-DD）
    const today = new Date().toISOString().split("T")[0];

    // 今日の記録を取得（Timestamp なので後で変換する）
    const recordSnap = await getDocs(collection(db, "records"));

    const enteredStaffIds = new Set();

    recordSnap.forEach(doc => {
      const data = doc.data();

      // Timestamp → Date → "YYYY-MM-DD" に変換
      const recordDate = data.date.toDate().toISOString().split("T")[0];

      // 今日の記録だけカウント
      if (recordDate === today) {
        enteredStaffIds.add(data.staffId);
      }
    });

    const enteredCount = enteredStaffIds.size;

    // 全スタッフ数
    const staffSnap = await getDocs(collection(db, "staff"));
    const totalStaff = staffSnap.size;

    // 未入力者数
    const notEntered = totalStaff - enteredCount;

    res.status(200).json({ count: notEntered });
  } catch (error) {
    console.error("today-not-entered-count error:", error);
    res.status(500).json({ count: 0 });
  }
}
