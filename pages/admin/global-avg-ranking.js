"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import BackButton from "@/components/BackButton";

export default function GlobalAvgRanking() {
  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const load = async () => {
      // ★ 全スタッフ取得（勤務日数を使う）
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs.map(doc => doc.data());

      // ★ 全記録取得（部署フィルタなし）
      const recSnap = await getDocs(collection(db, "records"));
      const records = recSnap.docs.map(doc => doc.data());

      const now = new Date();

      // ★ 期間フィルタ（個人画面と同じ）
      const filtered = records.filter(item => {
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

      // ★ 個人ごとに集計
      const totals = {};

      filtered.forEach(item => {
        const id = item.staffId;
        const name = item.name;
        const department = item.department;

        if (!totals[id]) {
          totals[id] = {
            staffId: id,
            name,
            department,
            totalMl: 0,
            workDays: 0,
            avgMl: 0,
          };
        }

        totals[id].totalMl += Number(item.ml || 0);
      });

      // ★ staff コレクションから勤務日数を反映
      staffList.forEach(s => {
        if (totals[s.staffId]) {
          totals[s.staffId].workDays = s.workDays || 0;
          totals[s.staffId].avgMl =
            s.workDays ? totals[s.staffId].totalMl / s.workDays : 0;
        }
      });

      // ★ 平均ランキング（勤務日数考慮）
      const sorted = Object.values(totals).sort(
        (a, b) => b.avgMl - a.avgMl
      );

      setRanking(sorted);
    };

    load();
  }, [period]);

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
  background: "#e8f6f6",
  padding: "16px",
  borderRadius: "16px",
  marginBottom: "12px",
  border: "1px solid #cfeeee",   // ← ★ 修正済み
  color: "#006b5f",
  display: "flex",
  alignItems: "center",
  gap: "14px",
};


  const iconBoxStyle = {
    background: "#cfeeee",
    color: "#006b5f",
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: "bold",
  };

  const getRankIcon = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🫧";
  };

  return (
    <main
      style={{
        padding: "20px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <BackButton to="/admin" />

      <h1
  style={{
    textAlign: "center",
    fontSize: "26px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "#006b5f",
  }}
>
  📊 勤務日数を考慮した平均使用量ランキング（mL/日）
</h1>


      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(period === "today")} onClick={() => setPeriod("today")}>今日</button>
        <button style={tabStyle(period === "month")} onClick={() => setPeriod("month")}>今月</button>
        <button style={tabStyle(period === "year")} onClick={() => setPeriod("year")}>今年</button>
        <button style={tabStyle(period === "all")} onClick={() => setPeriod("all")}>累計</button>
      </div>

      {/* ランキングカード */}
      {ranking.map((s, i) => (
        <div key={s.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(i)}</div>

          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
              {i + 1} 位：{s.name}（{s.department}）
            </p>
            <p style={{ margin: 0 }}>勤務日数：{s.workDays} 日</p>
            <p style={{ margin: 0, color: "#008b75", fontWeight: "bold" }}>
              平均使用量：{s.avgMl.toFixed(1)} mL/日
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
