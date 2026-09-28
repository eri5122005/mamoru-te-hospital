import { db } from "../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

// ★ normalizeMl をここに貼る（このままコピペOK）
function normalizeMl(value) {
  const ml = Number(value);

  if (isNaN(ml)) return 0;      // 数字に変換できない → 0
  if (ml < 0.1) return 0;       // 異常に小さい値 → 0
  if (ml > 1000) return 0;      // 異常に大きい値 → 0
  if (!Number.isFinite(ml)) return 0; // 無限大など → 0

  return ml; // 正常値
}

export default async function handler(req, res) {
  const { wardId, year } = req.query; // year = "2026"

  try {
    // ① 病棟スタッフ一覧（v9）
    const staffSnap = await getDocs(
      query(collection(db, "staff"), where("wardId", "==", wardId))
    );

    const staff = staffSnap.docs.map((doc) => ({
      staffId: doc.id,
      ...doc.data(),
    }));

    const staffIds = staff.map((s) => s.staffId);

    // ② 年間の開始・終了
    const start = new Date(Number(year), 0, 1);          // 2026-01-01 00:00
    const end = new Date(Number(year) + 1, 0, 1);        // 2027-01-01 00:00（翌年）

    // ③ 年間の記録（v9）
    const recordSnap = await getDocs(
      query(
        collection(db, "records"),
        where("date", ">=", start),
        where("date", "<", end)
      )
    );

    const records = recordSnap.docs
      .map((doc) => ({ recordId: doc.id, ...doc.data() }))
      .filter((r) => staffIds.includes(r.staffId));

    // ④ 月別集計（Timestamp → Date）
    const monthlyTotals = {};
    const monthlyCounts = {};

    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      monthlyTotals[key] = 0;
      monthlyCounts[key] = 0;
    }

    records.forEach((r) => {
      const d = r.date.toDate();               
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      if (monthlyTotals[monthKey] !== undefined) {
        // ★ Number → normalizeMl に変更
        monthlyTotals[monthKey] += normalizeMl(r.ml);
        monthlyCounts[monthKey] += 1;
      }
    });

    // ⑤ スタッフ別年間集計
    const staffStats = staff.map((s) => {
      const myRecords = records.filter((r) => r.staffId === s.staffId);

      // ★ Number → normalizeMl に変更
      const myTotal = myRecords.reduce((sum, r) => sum + normalizeMl(r.ml), 0);

      return {
        staffId: s.staffId,
        name: s.name,
        totalMl: myTotal,
        count: myRecords.length,
      };
    });

    return res.status(200).json({
      staff,
      records,
      monthlyTotals,
      monthlyCounts,
      staffStats,
    });

  } catch (error) {
    console.error("year records error:", error);
    return res.status(500).json({ error: "Failed to load year records" });
  }
}
