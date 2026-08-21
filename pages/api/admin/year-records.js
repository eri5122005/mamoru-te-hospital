import { db } from "../../../firebaseConfig";

export default async function handler(req, res) {
  const { wardId, year } = req.query; // year = "2026"

  try {
    // 病棟スタッフ一覧
    const staffSnap = await db
      .collection("staff")
      .where("wardId", "==", wardId)
      .get();

    const staff = staffSnap.docs.map((doc) => ({
      staffId: doc.id,
      ...doc.data(),
    }));

    const staffIds = staff.map((s) => s.staffId);

    // 年間の記録
    const start = new Date(`${year}-01-01`);
    const end = new Date(`${year}-12-31`);

    const recordSnap = await db
      .collection("records")
      .where("date", ">=", start)
      .where("date", "<=", end)
      .get();

    const records = recordSnap.docs
      .map((doc) => ({ recordId: doc.id, ...doc.data() }))
      .filter((r) => staffIds.includes(r.staffId));

    // 月別集計
    const monthlyTotals = {};
    const monthlyCounts = {};

    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      monthlyTotals[key] = 0;
      monthlyCounts[key] = 0;
    }

    records.forEach((r) => {
      const monthKey = r.date.slice(0, 7); // "2026-08"
      monthlyTotals[monthKey] += Number(r.ml);
      monthlyCounts[monthKey] += 1;
    });

    // スタッフ別年間集計
    const staffStats = staff.map((s) => {
      const myRecords = records.filter((r) => r.staffId === s.staffId);
      const myTotal = myRecords.reduce((sum, r) => sum + Number(r.ml), 0);

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
