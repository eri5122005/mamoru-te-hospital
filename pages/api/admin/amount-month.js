import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default async function handler(req, res) {
  try {
    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map((doc) => doc.data());

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
    const start = new Date(
      Date.UTC(year, month - 1, 1, -9, 0, 0)
    );

    // 日本時間の来月1日 00:00
    const end = new Date(
      Date.UTC(year, month, 1, -9, 0, 0)
    );

    // records 全件取得
    const recordSnap = await getDocs(collection(db, "records"));
    const records = recordSnap.docs.map((doc) => doc.data());

    // staffId ごとに今月の使用量を集計
    const map = {};

    records.forEach((r) => {
      if (!r.date) return;

      const recordDate = r.date.toDate();

      // 日本時間の今月の範囲に入っているか判定
      if (recordDate >= start && recordDate < end) {
        const id = r.staffId;
        const ml = Number(r.ml) || 0;

        if (!map[id]) map[id] = 0;
        map[id] += ml;
      }
    });

    // staff情報と合体
    const result = staffList.map((s) => ({
      staffId: s.staffId,
      name: s.name,
      total: Number((map[s.staffId] || 0).toFixed(2)),
    }));

    return res.status(200).json(result);

  } catch (error) {
    console.error("amount-month error:", error);

    return res.status(500).json({
      error: "Failed to load amount month",
    });
  }
}
