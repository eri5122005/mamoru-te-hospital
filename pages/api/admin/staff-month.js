import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

// ★ normalizeMl（あなたの環境のままでOK）
function normalizeMl(value) {
  const ml = Number(value);
  if (isNaN(ml)) return 0;
  if (ml < 0.1) return 0;
  if (ml > 1000) return 0;
  if (!Number.isFinite(ml)) return 0;
  return ml;
}

export default async function handler(req, res) {
  const { staffId } = req.query;

  try {
    const now = new Date();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const q = query(
      collection(db, "records"),
      where("staffId", "==", staffId),
      where("date", ">=", monthStart),
      where("date", "<", monthEnd)
    );

    const snap = await getDocs(q);

    let total = 0;
    const recordDays = new Set();   // ★ 追加：記録した日付を集める

    snap.forEach(doc => {
      const data = doc.data();

      // 使用量
      total += normalizeMl(data.ml);

      // ★ 記録日（YYYY-MM-DD）をセットに追加
      const dayStr = data.date.toDate().toISOString().split("T")[0];
      recordDays.add(dayStr);
    });

    // ★ 記録した日数
    const recordDayCount = recordDays.size;

    return res.status(200).json({
      total,
      recordDayCount,   // ★ これが勤務日数ベース入力率の材料
    });

  } catch (error) {
    console.error("staff-month error:", error);
    return res.status(500).json({ total: 0, recordDayCount: 0 });
  }
}
