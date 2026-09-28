import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 今日の開始（00:00）
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 今日の終了（23:59:59）
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // ★ 今日の記録だけ Firestore 側で絞り込む（高速）
    const recordSnap = await getDocs(
      query(
        collection(db, "records"),
        where("date", ">=", start),
        where("date", "<=", end)
      )
    );

    const enteredStaffIds = new Set(
      recordSnap.docs.map(doc => doc.data().staffId)
    );

    const enteredCount = enteredStaffIds.size;

    // 全スタッフ数
    const staffSnap = await getDocs(collection(db, "staff"));
    const totalStaff = staffSnap.size;

    // 未入力者数
    const notEntered = totalStaff - enteredCount;

    return res.status(200).json({ count: notEntered });

  } catch (error) {
    console.error("today-not-entered-count error:", error);
    return res.status(500).json({ count: 0 });
  }
}
