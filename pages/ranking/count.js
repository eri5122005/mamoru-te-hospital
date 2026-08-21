"use client";

import { useEffect, useState } from "react";
import RankingHeader from "../../components/RankingHeader";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function CountRanking() {
  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const load = async () => {
      const staff = JSON.parse(localStorage.getItem("currentStaff"));
      if (!staff) return;

      const q = query(
        collection(db, "records"),
        where("wardId", "==", staff.wardId)
      );

      const snap = await getDocs(q);
      const records = snap.docs.map(doc => doc.data());

      const now = new Date();

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

        return true;
      });

      const counts = {};
      filtered.forEach(item => {
        if (!counts[item.staffId]) {
          counts[item.staffId] = {
            staffId: item.staffId,
            name: item.name,
            department: item.department,
            count: 0
          };
        }
        counts[item.staffId].count += 1;
      });

      const sorted = Object.values(counts).sort(
        (a, b) => b.count - a.count
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
    return "🔢"; // 4位以下は通常アイコン
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
      <RankingHeader title="記録回数ランキング" icon="🔢" />

      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(period === "today")} onClick={() => setPeriod("today")}>今日</button>
        <button style={tabStyle(period === "month")} onClick={() => setPeriod("month")}>今月</button>
        <button style={tabStyle(period === "year")} onClick={() => setPeriod("year")}>今年</button>
        <button style={tabStyle(period === "all")} onClick={() => setPeriod("all")}>累計</button>
      </div>

      {/* ランキングカード（🥇🥈🥉入り） */}
      {ranking.length === 0 && (
        <p style={{ color: "#006b5f" }}>まだ記録がありません。</p>
      )}

      {ranking.map((item, index) => (
        <div key={item.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(index)}</div>

          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
              {index + 1} 位：{item.name}
            </p>
            <p style={{ margin: 0, color: "#008b75", fontWeight: "bold" }}>
              {item.count} 回
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
