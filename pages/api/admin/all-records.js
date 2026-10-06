import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    const snapshot = await getDocs(collection(db, "records"));
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(records);
  } catch (error) {
    console.error("all-records error:", error);
    res.status(500).json({ error: "failed to load records" });
  }
}
