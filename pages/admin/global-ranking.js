"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import BackButton from "@/components/BackButton";

export default function GlobalRanking() {
  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const load = async () => {
      // ★ 全スタッフ取得
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs.map(doc => doc.data());

      // ★ 全記録取得
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
        const id = item.staffId || "unknown";
        const name = item.name || "不明";

        if (!totals[id]) {
          totals[id] = {
            staffId: id,
            name,
            totalMl: 0,
            count: 0,
            workDays: 0,
            avgMl: 0,
          };
        }

        totals[id].totalMl += Number(item.ml || 0);
        totals[id].count += 1;
      });

      // ★ 勤務日数を staff コレクションから反映
      staffList.forEach(s => {
        if (totals[s.staffId]) {
          totals[s.staffId].workDays = s.workDays || 0;
          totals[s.staffId].avgMl =
            s.workDays ? totals[s.staffId].totalMl / s.workDays : 0;
        }
      });

      // ★ 使用量ランキング
      const sorted = Object.values(totals).sort(
        (a, b) => b.totalMl - a.totalMl
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
        🧴 院内個人ランキング
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
              {item.totalMl.toFixed(1)} mL（平均 {item.avgMl.toFixed(1)} mL）
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
