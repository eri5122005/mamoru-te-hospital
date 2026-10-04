import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const now = new Date();

    // 今日の開始（00:00:00）
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 今日の終了（23:59:59）
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // 今日の記録だけを Firestore 側で絞り込む
    const q = query(
      collection(db, "records"),
      where("date", ">=", start),
      where("date", "<=", end)
    );

    const snapshot = await getDocs(q);

    const enteredStaffIds = new Set();
    snapshot.forEach(doc => {
      enteredStaffIds.add(doc.data().staffId);
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
