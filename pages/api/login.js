import { db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { normalizeStaffId } from "../../utils/normalizeStaffId";
import { isActiveStaff } from "../../utils/isActiveStaff";

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

    const staffData = staffSnap.data();
    if (!isActiveStaff(staffData)) {
      return res.status(403).json({
        error: "この職員番号は現在利用できません。管理者に確認してください。",
      });
    }

    return res.status(200).json({
      firstLogin: false,
      staff: staffData,
    });

  } catch (error) {
    console.error("Login API Error:", error);
    return res.status(500).json({ error: "Server error" });
  }
}
