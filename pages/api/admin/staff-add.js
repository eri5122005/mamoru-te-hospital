import { db } from "../../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { staffId, name, wardId } = req.body;

  try {
    const staffRef = doc(db, "staff", staffId);
    await setDoc(staffRef, {
      staffId,
      name,
      wardId,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("staff add error:", error);
    return res.status(500).json({ error: "Failed to add staff" });
  }
}
