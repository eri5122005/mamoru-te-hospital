import { db } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,   // ← これが抜けてる！
  updateDoc,
  Timestamp,
} from "firebase/firestore";


export default async function handler(req, res) {
  // ★ POST：新規記録
  if (req.method === "POST") {
    const { staffId, name, department, wardId, amount, unit, ml, mintPoint } = req.body;

    try {
      const docRef = await addDoc(collection(db, "records"), {
        staffId: staffId ?? "",
        name: name ?? "",
        department: department ?? "",
        wardId: wardId ?? "",
        amount: Number(amount),
        unit,
        ml: Number(ml),
        mintPoint: Number(mintPoint ?? 0),
        date: Timestamp.now(),
      });

      return res.status(200).json({ ok: true, recordId: docRef.id });
    } catch (error) {
      console.error("POST error:", error);
      return res.status(500).json({ error: "Failed to save record" });
    }
  }
  // ★ GET：全件取得（履歴用）
if (req.method === "GET" && !req.query.id) {
  try {
    const snapshot = await getDocs(collection(db, "records"));
    const records = snapshot.docs.map(doc => ({
      recordId: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ records });
  } catch (error) {
    console.error("GET all error:", error);
    return res.status(500).json({ error: "Failed to load records" });
  }
}


  // ★ GET：記録取得
  if (req.method === "GET") {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    try {
      const docSnap = await getDoc(doc(db, "records", id));

      if (!docSnap.exists()) {
        return res.status(404).json({ error: "Record not found" });
      }

      return res.status(200).json({
        record: {
          recordId: docSnap.id,
          ...docSnap.data(),
        },
      });
    } catch (error) {
      console.error("GET error:", error);
      return res.status(500).json({ error: "Failed to load record" });
    }
  }

  // ★ PATCH：記録修正
  if (req.method === "PATCH") {
    const { recordId, ml } = req.body;

    try {
      await updateDoc(doc(db, "records", recordId), {
        ml: Number(ml),
        updatedAt: Timestamp.now(),
      });

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("PATCH error:", error);
      return res.status(500).json({ error: "Failed to update record" });
    }
  }

  // ★ その他のメソッド
  return res.status(405).json({ error: "Method not allowed" });
}
