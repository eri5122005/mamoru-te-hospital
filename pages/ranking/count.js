"use client";

import { useEffect, useState } from "react";
import RankingHeader from "../../components/RankingHeader";

export default function CountRanking() {
  const [period, setPeriod] = useState("all");
  const [ranking, setRanking] = useState([]);

  // ★ 期間で絞り込む useEffect（ランキング計算もここでやる）
  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("history") || "[]");
    const now = new Date();

    // 期間で絞り込み
    const filtered = history.filter(item => {
      const t = new Date(item.timestamp);

      if (period === "today") {
        return (
          t.getFullYear() === now.getFullYear() &&
          t.getMonth() === now.getMonth() &&
          t.getDate() === now.getDate()
        );
      }

      if (period === "month") {
        return (
          t.getFullYear() === now.getFullYear() &&
          t.getMonth() === now.getMonth()
        );
      }

      return true; // 累計
    });

    // 回数集計
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
  }, [period]);

  // ★ ランクの色
  const getRankStyle = (index) => {
    if (index === 0) {
      return { background: "#FFF8E1", border: "2px solid #FFD700" };
    }
    if (index === 1) {
      return { background: "#F0F0F0", border: "2px solid #C0C0C0" };
    }
    if (index === 2) {
      return { background: "#FBE9E7", border: "2px solid #CD7F32" };
    }
    return { background: "#ffffff", border: "1px solid #cfeeee" };
  };

  return (
    <main
      style={{
        padding: "20px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif"
      }}
    >
      <RankingHeader title="記録回数ランキング" />

      {/* ★ 期間切り替えボタン */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => setPeriod("today")} style={periodButtonStyle}>今日</button>
        <button onClick={() => setPeriod("month")} style={periodButtonStyle}>今月</button>
        <button onClick={() => setPeriod("all")} style={periodButtonStyle}>累計</button>
      </div>

      {/* ★ ランキング内容 */}
      {ranking.length === 0 && (
        <p style={{ color: "#006b5f" }}>まだ記録がありません。</p>
      )}

      {ranking.map((item, index) => (
        <div
          key={item.staffId}
          style={{
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            ...getRankStyle(index)
          }}
        >
          <div>
            <p style={{ fontSize: "20px", color: "#006b5f", fontWeight: "bold" }}>
              {index + 1} 位：{item.name}
            </p>
            <p style={{ color: "#008b75" }}>{item.department}</p>
          </div>

          <p style={{ fontSize: "22px", color: "#008b75", fontWeight: "bold" }}>
            {item.count} 回
          </p>
        </div>
      ))}
    </main>
  );
}

// ★ ボタンのデザインはファイルの一番下
const periodButtonStyle = {
  background: "#cfeeee",
  color: "#006b5f",
  border: "none",
  padding: "10px 16px",
  borderRadius: "12px",
  fontSize: "16px",
  cursor: "pointer"
};

