"use client";

import { useEffect, useState } from "react";
import { db } from "../../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/router";

export default function WardStaffRanking() {
  const router = useRouter();
  const { wardId } = router.query;

  if (!wardId) return null;

  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  const wardNameMap = {
    "6f": "6階",
    "5f": "5階",
    "4f": "4階",
  };


  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // ★ その病棟のスタッフ一覧
      const staffSnap = await getDocs(
        query(collection(db, "staff"), where("wardId", "==", wardId))
      );
      const staffList = staffSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // ★ その病棟の記録
      const recordSnap = await getDocs(
        query(collection(db, "records"), where("wardId", "==", wardId))
      );
      const records = recordSnap.docs.map((d) => d.data());

      const now = new Date();

      // ★ 期間フィルタ
      const filtered = records.filter((item) => {
        const t = item.date.toDate();
        const jst =
          t.getTimezoneOffset() === 0
            ? new Date(t.getTime() + 9 * 60 * 60 * 1000)
            : t;

        if (period === "today") {
          return (
            jst.getFullYear() === now.getFullYear() &&
            jst.getMonth() === now.getMonth() &&
            jst.getDate() === now.getDate()
          );
        }

        if (period === "month") {
          return (
            jst.getFullYear() === now.getFullYear() &&
            jst.getMonth() === now.getMonth()
          );
        }

        if (period === "year") {
          return jst.getFullYear() === now.getFullYear();
        }

        return true; // 累計
      });

      // ★ スタッフごとに集計（記録ゼロでも出す）
      const result = staffList.map((staff) => {
        const myRecords = filtered.filter(
          (r) => r.staffId === staff.staffId
        );

        const totalMl = myRecords.reduce(
          (sum, r) => sum + Number(r.ml || 0),
          0
        );

        return {
          staffId: staff.staffId,
          name: staff.name,
          department: wardNameMap[staff.wardId] || staff.department,
          totalMl,
        };
      });

      // ★ ソート
      result.sort((a, b) => b.totalMl - a.totalMl);

      setRanking(result);
      setLoading(false);
    };

    load();
  }, [period, wardId]);

  if (loading) return <p>読み込み中です…</p>;

  const tabStyle = (active) => ({
    flex: 1,
    padding: "10px 0",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    background: active ? "#006b5f" : "#cfeeee",
    color: active ? "#ffffff" : "#006b5f",
    fontSize: "14px",
  });

  const cardStyle = {
    background: "#ffffff",
    padding: "16px",
    borderRadius: "14px",
    marginBottom: "12px",
    border: "1px solid #cfeeee",
    color: "#006b5f",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  };

  const iconBoxStyle = {
    background: "#cfeeee",
    color: "#006b5f",
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "26px",
  };

  const getRankIcon = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🧴";
  };

  return (
    <main
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <button
        onClick={() => router.push(`/admin/ward/${wardId}`)}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          cursor: "pointer",
          marginBottom: "20px",
          width: "100%",
        }}
      >
        ← 部署管理メニューに戻る
      </button>

      <h1
        style={{
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          marginBottom: "20px",
          color: "#006b5f",
        }}
      >
        {wardNameMap[wardId]} 個人ランキング
      </h1>

      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(period === "today")} onClick={() => setPeriod("today")}>今日</button>
        <button style={tabStyle(period === "month")} onClick={() => setPeriod("month")}>今月</button>
        <button style={tabStyle(period === "year")} onClick={() => setPeriod("year")}>今年</button>
        <button style={tabStyle(period === "all")} onClick={() => setPeriod("all")}>累計</button>
      </div>

      {/* ランキング */}
      {ranking.map((item, index) => (
        <div key={item.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(index)}</div>

          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
              {index + 1} 位：{item.name}
            </p>
            <p style={{ margin: 0, color: "#008b75", fontWeight: "bold" }}>
              {item.totalMl.toFixed(1)} mL
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
