"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

export default function SuperAdminPage() {
  const [yearData, setYearData] = useState([]);
  const [loading, setLoading] = useState(true);

  const wardIds = ["ward01", "ward02", "ward03"]; // ★ あなたの病棟ID一覧
  const year = "2026"; // ★ 表示したい年

  useEffect(() => {
    const loadAll = async () => {
      try {
        const results = [];

        for (const id of wardIds) {
          const res = await fetch(`/api/admin/year-records?wardId=${id}&year=${year}`);
          const json = await res.json();
          results.push({ wardId: id, ...json });
        }

        setYearData(results);
        setLoading(false);
      } catch (error) {
        alert("年間データの取得に失敗しました");
      }
    };

    loadAll();
  }, []);

  if (loading) return <div>読み込み中...</div>;

  const cardStyle = {
    background: "#e8f6f6",
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
    border: "2px solid #aeece4",
  };

  const titleStyle = {
    color: "#00a68c",
    marginBottom: "12px",
    fontSize: "20px",
    fontWeight: "bold",
  };

  // ★ 年間ランキング作成
  const totalMlRanking = [...yearData]
    .map((w) => ({
  wardId: w.wardId,
  totalMl: Object.values(w.monthlyTotals || {}).reduce((a, b) => a + b, 0),
}))

    .sort((a, b) => b.totalMl - a.totalMl);

  const countRanking = [...yearData]
    .map((w) => ({
      wardId: w.wardId,
      totalCount: Object.values(w.monthlyCounts || {}).reduce((a, b) => a + b, 0),

    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  const rateRanking = [...yearData]
    .map((w) => {
      const staffCount = (w.staff || []).length;

      const totalCount = Object.values(w.monthlyCounts || {}).reduce((a, b) => a + b, 0);
      const rate = staffCount === 0 ? 0 : Math.round((totalCount / (staffCount * 365)) * 100);
      return { wardId: w.wardId, rate };
    })
    .sort((a, b) => b.rate - a.rate);

  return (
    <AdminLayout>
      <h1
        style={{
          color: "#00a68c",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        super管理者ページ（年間ランキング付き）
      </h1>

      {/* 年間使用量ランキング */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>🔥 年間使用量ランキング（多い順）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {totalMlRanking.map((r, i) => (
            <li key={r.wardId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{r.wardId}（{r.totalMl} mL）
            </li>
          ))}
        </ul>
      </div>

      {/* 年間記録件数ランキング */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>📊 年間記録件数ランキング（多い順）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {countRanking.map((r, i) => (
            <li key={r.wardId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{r.wardId}（{r.totalCount} 回）
            </li>
          ))}
        </ul>
      </div>

      {/* 年間入力率ランキング */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>🏆 年間入力率ランキング（高い順）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {rateRanking.map((r, i) => (
            <li key={r.wardId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{r.wardId}（{r.rate}%）
            </li>
          ))}
        </ul>
      </div>
    </AdminLayout>
  );
}
