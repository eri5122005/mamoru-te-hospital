import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 現在時刻
    const now = new Date();

    // 現在の「日本時間の年月」を取得
    const jstParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(now);

    const year = Number(
      jstParts.find((part) => part.type === "year").value
    );

    const month = Number(
      jstParts.find((part) => part.type === "month").value
    );

    // 日本時間の今月1日 00:00
    // JST 00:00 = UTC 前日15:00
    const start = new Date(
      Date.UTC(year, month - 1, 1, -9, 0, 0)
    );

    // 日本時間の来月1日 00:00
    const end = new Date(
      Date.UTC(year, month, 1, -9, 0, 0)
    );

    // 今月のrecordsだけ取得
    const q = query(
      collection(db, "records"),
      where("date", ">=", start),
      where("date", "<", end)
    );

    const snapshot = await getDocs(q);

    let total = 0;

    snapshot.forEach((doc) => {
      total += Number(doc.data().ml) || 0;
    });

    res.status(200).json({
      total: Number(total.toFixed(2)),
    });

  } catch (error) {
    console.error("month-total error:", error);
    res.status(500).json({ total: 0 });
  }
}