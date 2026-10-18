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

    const japanDate = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    });
    const getJstParts = (date) => {
      const parts = japanDate.formatToParts(date);
      const part = (type) => parts.find((item) => item.type === type).value;
      return { year: part("year"), month: part("month"), day: part("day") };
    };
    const current = getJstParts(now);
    const year = Number(current.year);
    const month = Number(current.month);
    // JST midnight is 15:00 UTC on the previous day. UTC arithmetic handles year rollover.
    const monthStart = new Date(Date.UTC(year, month - 1, 1, -9));
    const monthEnd = new Date(Date.UTC(year, month, 1, -9));

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
      const parts = getJstParts(data.date.toDate());
      const dayStr = `${parts.year}-${parts.month}-${parts.day}`;
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
