import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 今日の日付（YYYY-MM-DD）
    const today = new Date().toISOString().split("T")[0];

    // 今日の記録を取得（Timestamp なので後で変換する）
    const q = query(collection(db, "records"));
    const snapshot = await getDocs(q);

    const enteredStaffIds = new Set();

    snapshot.forEach(doc => {
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

    const rate =
      totalStaff === 0 ? 0 : Math.round((enteredCount / totalStaff) * 100);

    res.status(200).json({ rate });
  } catch (error) {
    console.error("today-rate error:", error);
    res.status(500).json({ rate: 0 });
  }
}
