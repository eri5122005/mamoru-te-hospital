import { db } from "./firebaseConfig.js";
import { collection, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";

async function fixRecords() {
  const snap = await getDocs(collection(db, "records"));

  for (const d of snap.docs) {
    const data = d.data();
    const updates = {};

    // date が文字列なら Timestamp に変換
    if (typeof data.date === "string") {
      updates.date = Timestamp.fromDate(new Date(data.date));
    }

    // ml が文字列なら Number に変換
    if (typeof data.ml === "string") {
      const num = Number(data.ml.replace(/[^0-9]/g, ""));
      updates.ml = isNaN(num) ? 0 : num;
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, "records", d.id), updates);
      console.log("fixed:", d.id, updates);
    }
  }

  console.log("done");
}

fixRecords();
