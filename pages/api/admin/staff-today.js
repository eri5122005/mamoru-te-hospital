import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

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

    // 現在の「日本の日付」を取得
    const jstParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const year = Number(
      jstParts.find((part) => part.type === "year").value
    );

    const month = Number(
      jstParts.find((part) => part.type === "month").value
    );

    const day = Number(
      jstParts.find((part) => part.type === "day").value
    );

    // 今日の0:00 JST
    const start = new Date(
      Date.UTC(year, month - 1, day, -9, 0, 0)
    );

    // 今日の23:59:59.999 JST
    const end = new Date(
      Date.UTC(year, month - 1, day, 14, 59, 59, 999)
    );

    const q = query(
      collection(db, "records"),
      where("staffId", "==", staffId),
      where("date", ">=", start),
      where("date", "<=", end)
    );

    const snap = await getDocs(q);

    let total = 0;

    snap.forEach((doc) => {
      total += normalizeMl(doc.data().ml);
    });

    return res.status(200).json({
      total: Number(total.toFixed(2)),
    });

  } catch (error) {
    console.error("staff-today error:", error);
    return res.status(500).json({ total: 0 });
  }
}