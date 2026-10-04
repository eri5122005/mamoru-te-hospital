import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  const now = new Date();

  // 今日の開始（00:00:00）
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 今日の終了（23:59:59）
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const q = query(
    collection(db, "records"),
    where("date", ">=", start),
    where("date", "<=", end)
  );

  const snapshot = await getDocs(q);

  const list = snapshot.docs.map(doc => ({
    name: doc.data().name,
    wardName: doc.data().wardName,
    amount: Number(doc.data().ml) || 0,
    time: doc.data().time || null,
  }));

  // 使用量でソート（ランキング）
  list.sort((a, b) => b.amount - a.amount);

  res.status(200).json(list);
}
