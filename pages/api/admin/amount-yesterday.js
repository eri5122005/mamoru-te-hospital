import { db } from "../../../firebaseConfig";
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

    // 日本時間の「昨日」を基準にする
    // Date.UTC を使って日付を1日前にずらす
    const yesterdayBase = new Date(
      Date.UTC(year, month - 1, day - 1)
    );

    const yesterdayYear = yesterdayBase.getUTCFullYear();
    const yesterdayMonth = yesterdayBase.getUTCMonth();
    const yesterdayDay = yesterdayBase.getUTCDate();

    // 日本時間 昨日 00:00:00
    // JST 00:00 = UTC 前日15:00
    const start = new Date(
      Date.UTC(
        yesterdayYear,
        yesterdayMonth,
        yesterdayDay,
        -9,
        0,
        0
      )
    );

    // 日本時間 昨日 23:59:59.999
    // JST 23:59:59.999 = UTC 14:59:59.999
    const end = new Date(
      Date.UTC(
        yesterdayYear,
        yesterdayMonth,
        yesterdayDay,
        14,
        59,
        59,
        999
      )
    );

    // records 全件取得
    const recordSnap = await getDocs(collection(db, "records"));
    const records = recordSnap.docs.map((doc) => doc.data());

    // staffId ごとに ml を合計
    const map = {};

    records.forEach((r) => {
      if (!r.date) return;

      const recordDate = r.date.toDate();

      // 日本時間の昨日の範囲に入っているか判定
      if (recordDate >= start && recordDate <= end) {
        const id = r.staffId;
        const ml = Number(r.ml) || 0;

        if (!map[id]) map[id] = 0;
        map[id] += ml;
      }
    });

    // スタッフ一覧
    const staffSnap = await getDocs(collection(db, "staff"));
    const staffList = staffSnap.docs.map((doc) => doc.data());

    // staff 情報と合体
    const result = staffList.map((s) => ({
      staffId: s.staffId,
      name: s.name,
      total: Number((map[s.staffId] || 0).toFixed(2)),
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("amount-yesterday error:", error);
    return res.status(500).json({
      error: "Failed to load amount yesterday",
    });
  }
}