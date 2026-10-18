import { db } from "../../../firebaseConfig";
import { doc, runTransaction } from "firebase/firestore";
import { validateStaffRegistration } from "../../../utils/adminStaffRegistration";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { data, error } = validateStaffRegistration(req.body);
  if (error) return res.status(400).json({ error });

  try {
    const created = await runTransaction(db, async (transaction) => {
      const staffRef = doc(db, "staff", data.staffId);
      const backupRef = doc(db, "staffs", data.staffId);
      const staff = await transaction.get(staffRef);
      const backup = await transaction.get(backupRef);
      if (staff.exists() || backup.exists()) return false;
      transaction.set(staffRef, data);
      transaction.set(backupRef, data);
      return true;
    });
    if (!created) return res.status(409).json({ error: "この職員番号は既に登録されています。" });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("staff add error:", error);
    return res.status(500).json({ error: "登録結果を確認できませんでした。再登録せず、管理者に確認してください。" });
  }
}
