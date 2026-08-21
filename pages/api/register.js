import { db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { staffId, name, wardId } = req.body;

  if (!staffId || !name || !wardId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // ★ staff コレクションに新規登録（v9）
    const staffRef = doc(db, "staff", staffId);
    await setDoc(staffRef, {
      name,
      wardId,
      createdAt: new Date(),
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Register API Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
