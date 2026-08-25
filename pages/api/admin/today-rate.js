import { db } from "../../../firebaseConfig";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 全スタッフ数
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffCount = staffSnap.size;

    // 今日の日付
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 今日の記録
    const q = query(
      collection(db, "records"),
      where("date", ">=", today)
    );
    const usageSnap = await getDocs(q);
    const usedCount = usageSnap.size;

    // 入力率
    const rate =
      staffCount === 0 ? 0 : Math.round((usedCount / staffCount) * 100);

    res.status(200).json({ rate });
  } catch (error) {
    console.error("today-rate error:", error);
    res.status(500).json({ error: "Failed to calculate today rate" });
  }
}

