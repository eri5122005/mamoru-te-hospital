"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useRouter } from "next/router";

export default function DepartmentRanking() {
  const router = useRouter();
  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRanking = async () => {
      try {
        const q = query(collection(db, "records"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((doc) => doc.data());

        const now = new Date();

        const filtered = list.filter((item) => {
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

        const totals = {};

        filtered.forEach((item) => {
          const dept = item.department || "不明";
          const ml = Number(item.ml) || 0;

          if (!totals[dept]) totals[dept] = 0;
          totals[dept] += ml;
        });

        const rankingList = Object.entries(totals)
          .map(([dept, total]) => ({
            department: dept,
            total: Number(total.toFixed(1)),
          }))
          .sort((a, b) => b.total - a.total);

        setRanking(rankingList);
      } catch (error) {
        console.error("ランキング取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRanking();
  }, [period]);

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
    return "🏥"; // 4位以下は通常アイコン
  };

  return (
    <div
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
        onClick={() => router.push("/ranking")}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "20px",
          width: "100%",
        }}
      >
        ← ランキングメニューに戻る
      </button>

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
        }}
      >
        🏥 院内部署ランキング
      </h1>

      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(period === "today")} onClick={() => setPeriod("today")}>今日</button>
        <button style={tabStyle(period === "month")} onClick={() => setPeriod("month")}>今月</button>
        <button style={tabStyle(period === "year")} onClick={() => setPeriod("year")}>今年</button>
        <button style={tabStyle(period === "all")} onClick={() => setPeriod("all")}>累計</button>
      </div>

      {/* ランキングカード（🥇🥈🥉入り） */}
      {ranking.map((item, index) => (
        <div key={index} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(index)}</div>

          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
              {index + 1} 位：{item.department}
            </p>
            <p style={{ margin: 0, color: "#008b75", fontWeight: "bold" }}>
              {item.total} mL
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const periodButtonStyle = {
  background: "#cfeeee",
  color: "#006b5f",
  border: "none",
  padding: "10px 16px",
  borderRadius: "12px",
  fontSize: "16px",
  cursor: "pointer",
};
