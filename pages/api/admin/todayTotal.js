// force rebuild
export const revalidate = 0;

import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // 現在時刻
    const now = new Date();

    // 現在の「日本時間の日付」を取得
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

    // 日本時間 00:00:00 ～ 23:59:59 をUTCのDateとして作成
    const start = new Date(
      Date.UTC(year, month - 1, day, -9, 0, 0)
    );

    const end = new Date(
      Date.UTC(year, month - 1, day, 14, 59, 59, 999)
    );

    const snapshot = await getDocs(collection(db, "records"));

    let total = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.date) return;

      const recordDate = data.date.toDate();

      if (recordDate >= start && recordDate <= end) {
        total += Number(data.ml) || 0;
      }
    });

    res.status(200).json({
      total: Number(total.toFixed(2)),
    });
  } catch (error) {
    console.error("today-total error:", error);
    res.status(500).json({ total: 0 });
  }
}