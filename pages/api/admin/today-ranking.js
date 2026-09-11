import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;

  const q = query(
    collection(db, "records"),
    where("date", "==", todayStr)
  );

  const snapshot = await getDocs(q);

  const list = snapshot.docs.map(doc => ({
    name: doc.data().name,
    wardName: doc.data().wardName,
    amount: doc.data().amount,
    time: doc.data().time || null,
  }));

  // 使用量でソート（ランキング）
  list.sort((a, b) => b.amount - a.amount);

  res.status(200).json(list);
}
