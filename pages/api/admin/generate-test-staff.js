import { db } from "../../../firebaseConfig";
import { collection, getDocs, addDoc } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 病棟一覧を取得
    const wardsSnap = await getDocs(collection(db, "wards"));
    const wards = wardsSnap.docs.map(doc => doc.data());

    // 各病棟にテストスタッフを追加
    for (const ward of wards) {
      await addDoc(collection(db, "staff"), {
        staffId: `test-${ward.wardId}`,
        name: `${ward.name}テストスタッフ`,
        department: ward.name,
        wardId: ward.wardId,
        role: "staff",
        isActive: true,
        workDays: "10",
      });
    }

    res.status(200).json({ message: "テストスタッフを追加しました" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "追加に失敗しました" });
  }
}
