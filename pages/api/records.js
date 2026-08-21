import { db } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

export default async function handler(req, res) {
  // ★ 記録の新規登録（POST）
if (req.method === "POST") {
  const { staffId, name, department, wardId, amount, unit, ml, mintPoint } = req.body;

  try {
    const docRef = await addDoc(collection(db, "records"), {
  staffId,
  name,
  department,
  wardId,
  amount,
  unit,
  ml,
  mintPoint,
  date: new Date(),


 // ← ★JSTで保存！
});

    return res.status(200).json({ ok: true, recordId: docRef.id });
  } catch (error) {
    console.error("POST error:", error);
    return res.status(500).json({ error: "Failed to save record" });
  }
}


  // ★ 記録の取得（GET）
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

  // ★ 記録の修正（PATCH）
  if (req.method === "PATCH") {
    const { recordId, ml } = req.body;

    try {
      await updateDoc(doc(db, "records", recordId), {
        ml,
        updatedAt: new Date(),
      });

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("PATCH error:", error);
      return res.status(500).json({ error: "Failed to update record" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
