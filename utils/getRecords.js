import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";  // ★ここがあなたの環境に合わせたポイント

export async function getRecords() {
  const snapshot = await getDocs(collection(db, "records"));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}
