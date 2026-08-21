"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

// ★ グラフ用 import（必須）
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function YearRecordsPage() {
  const [data, setData] = useState(null);
  const [compareData, setCompareData] = useState([]); // ★ 追加
  const [loading, setLoading] = useState(true);

  const wardId = "ward01";
  const year = "2026";

  useEffect(() => {
    const load = async () => {
      try {
        // メイン病棟
        const res = await fetch(`/api/admin/year-records?wardId=${wardId}&year=${year}`);
        const json = await res.json();
        setData(json);

        // 病棟別比較データ
        const wardIds = ["ward01", "ward02", "ward03"];
        const results = [];

        for (const wid of wardIds) {
          const res2 = await fetch(`/api/admin/year-records?wardId=${wid}&year=${year}`);
          const json2 = await res2.json();
          results.push({ wardId: wid, ...json2 });
        }

        setCompareData(results);

        setLoading(false);
      } catch (error) {
        alert("年間集計の取得に失敗しました");
      }
    };

    load();
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

  // ★ スタッフランキング
  const mlRanking = [...data.staffStats].sort((a, b) => b.totalMl - a.totalMl);
  const countRanking = [...data.staffStats].sort((a, b) => b.count - a.count);
  const avgRanking = [...data.staffStats]
    .map((s) => ({
      ...s,
      avg: s.count === 0 ? 0 : Math.round(s.totalMl / s.count),
    }))
    .sort((a, b) => b.avg - a.avg);

  // ★ 病棟別年間ランキング（ここで作る）
  const totalMlRanking = compareData
    .map((w) => ({
      wardId: w.wardId,
      totalMl: Object.values(w.monthlyTotals).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.totalMl - a.totalMl);

  const countWardRanking = compareData
    .map((w) => ({
      wardId: w.wardId,
      totalCount: Object.values(w.monthlyCounts).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  const rateWardRanking = compareData
    .map((w) => {
      const staffCount = w.staff.length;
      const totalCount = Object.values(w.monthlyCounts).reduce((a, b) => a + b, 0);
      const rate = staffCount === 0 ? 0 : Math.round((totalCount / (staffCount * 365)) * 100);
      return { wardId: w.wardId, rate };
    })
    .sort((a, b) => b.rate - a.rate);

  // ★ 病棟別年間グラフデータ
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const colors = ["#00a68c", "#66cfc4", "#aeece4"];

  const compareChart = {
    labels: months,
    datasets: compareData.map((w, index) => ({
      label: w.wardId,
      data: months.map((m) => w.monthlyTotals[m] || 0),
      borderColor: colors[index % colors.length],
      backgroundColor: `${colors[index % colors.length]}55`,
      tension: 0.3,
      fill: true,
    })),
  };

  return (
    <AdminLayout>
      <h1
        style={{
          color: "#00a68c",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        {year} 年の年間集計（スタッフ別ランキング付き）
      </h1>

      {/* ★ 病棟別年間グラフ */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>🏥 病棟別・年間使用量グラフ</h2>
        <Line data={compareChart} />
      </div>

      {/* ★ 病棟別年間比較ランキング（ここに追加） */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>🔥 病棟別・年間使用量ランキング（多い順）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {totalMlRanking.map((r, i) => (
            <li key={r.wardId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{r.wardId}（{r.totalMl} mL）
            </li>
          ))}
        </ul>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>📊 病棟別・年間記録件数ランキング（多い順）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {countWardRanking.map((r, i) => (
            <li key={r.wardId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{r.wardId}（{r.totalCount} 回）
            </li>
          ))}
        </ul>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>🏆 病棟別・年間入力率ランキング（高い順）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {rateWardRanking.map((r, i) => (
            <li key={r.wardId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{r.wardId}（{r.rate}%）
            </li>
          ))}
        </ul>
      </div>

      {/* ★ ここからスタッフ別ランキング（あなたの元コード） */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>🔥 年間使用量ランキング（多い順）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {mlRanking.map((s, i) => (
            <li key={s.staffId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{s.name}（{s.totalMl} mL）
            </li>
          ))}
        </ul>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>📊 年間記録件数ランキング（多い順）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {countRanking.map((s, i) => (
            <li key={s.staffId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{s.name}（{s.count} 回）
            </li>
          ))}
        </ul>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>💧 平均使用量ランキング（1回あたり）</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {avgRanking.map((s, i) => (
            <li key={s.staffId} style={{ marginBottom: "10px" }}>
              {i + 1} 位：{s.name}（平均 {s.avg} mL）
            </li>
          ))}
        </ul>
      </div>
    </AdminLayout>
  );
}
