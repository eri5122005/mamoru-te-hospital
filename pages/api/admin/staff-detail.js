import { db } from "../../../firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";

export default async function handler(req, res) {
  const { id } = req.query; // staffId

  try {
    // ① スタッフ情報
    const staffRef = doc(db, "staff", id);
    const staffSnap = await getDoc(staffRef);

    if (!staffSnap.exists()) {
      return res.status(404).json({ error: "Staff not found" });
    }

    const staff = { staffId: id, ...staffSnap.data() };

    // ② 今月の開始と終了
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1); // ★ 来月の1日

    // ③ 今月の記録だけ取得（高速）
    const recordQ = query(
      collection(db, "records"),
      where("staffId", "==", id),
      where("date", ">=", monthStart),
      where("date", "<", monthEnd)   // ★ 月末までの範囲指定
    );

    const recordSnap = await getDocs(recordQ);

    const records = recordSnap.docs.map((doc) => ({
      recordId: doc.id,
      ...doc.data(),
      wardId: staff.wardId,   // 部署絞り込み用
    }));

    const totalMl = records.reduce((sum, r) => sum + Number(r.ml), 0);

    return res.status(200).json({
      staff,
      records,
      totalMl,
      count: records.length,
    });

  } catch (error) {
    console.error("staff detail error:", error);
    return res.status(500).json({ error: "Failed to load staff detail" });
  }
}
