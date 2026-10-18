import { db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { normalizeStaffId } from "../../utils/normalizeStaffId";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const staffId = req.body?.staffId;
  if (typeof staffId !== "string") {
    return res.status(400).json({ error: "Invalid staffId" });
  }
  const normalizedStaffId = normalizeStaffId(staffId);

  if (!normalizedStaffId) {
    return res.status(400).json({ error: "Missing staffId" });
  }

  try {
    const staffRef = doc(db, "staff", normalizedStaffId);
    const staffSnap = await getDoc(staffRef);

    if (!staffSnap.exists()) {
      return res.status(200).json({ firstLogin: true });
    }

    return res.status(200).json({
      firstLogin: false,
      staff: staffSnap.data(),
    });

  } catch (error) {
    console.error("Login API Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
