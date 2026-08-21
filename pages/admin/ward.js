import { db } from "../../../firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

export default async function handler(req, res) {
  const { id } = req.query; // wardId（例：6F, 外来, 透析）

  try {
    // ① 部署スタッフ一覧
    const staffQuery = query(
      collection(db, "staff"),
      where("department", "==", id)
    );
    const staffSnap = await getDocs(staffQuery);

    const staffList = staffSnap.docs.map((doc) => ({
      staffId: doc.id,
      ...doc.data(),
    }));

    // ② 今日の日付（JST）
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ③ 今日の記録一覧
    const recordQuery = query(
      collection(db, "records"),
      where("department", "==", id),
      where("date", ">=", today)
    );
    const recordSnap = await getDocs(recordQuery);

    const todayRecords = recordSnap.docs.map((doc) => ({
      recordId: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate(),
    }));

    // ④ 未入力者
    const recordedIds = todayRecords.map((r) => r.staffId);
    const notEntered = staffList.filter(
      (s) => !recordedIds.includes(s.staffId)
    );

    // ⑤ 今日の合計使用量
    const totalMl = todayRecords.reduce(
      (sum, r) => sum + Number(r.ml || 0),
      0
    );

    // ⑥ レスポンス
    res.status(200).json({
      staff: staffList,
      records: todayRecords,
      notEntered,
      totalMl,
    });

  } catch (error) {
    console.error("部署APIエラー:", error);
    res.status(500).json({ error: "部署データの取得に失敗しました" });
  }
}
