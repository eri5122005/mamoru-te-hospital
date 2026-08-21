"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function MonthRecordsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const wardId = "ward06"; // ← 6階病棟の wardId に変更

  const month = "2026-08"; // ★ 表示したい月

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/month-records?wardId=${wardId}&month=${month}`);
        const json = await res.json();
        setData(json);
        setLoading(false);
      } catch (error) {
        alert("月別集計の取得に失敗しました");
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

  // ★ 日別集計（折れ線グラフ用）
  const dailyTotals = {};
  data.records.forEach((r) => {
    const day = r.date.split("T")[0];
    if (!dailyTotals[day]) dailyTotals[day] = 0;
    dailyTotals[day] += Number(r.ml);
  });

  const dailyLabels = Object.keys(dailyTotals).sort();
  const dailyValues = dailyLabels.map((d) => dailyTotals[d]);

  const dailyChart = {
    labels: dailyLabels,
    datasets: [
      {
        label: "日別使用量（mL）",
        data: dailyValues,
        borderColor: "#00a68c",
        backgroundColor: "rgba(0, 166, 140, 0.3)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  // ★ スタッフ別集計（棒グラフ用）
  const staffLabels = data.staffStats.map((s) => s.name);
  const staffValues = data.staffStats.map((s) => s.totalMl);

  const staffChart = {
    labels: staffLabels,
    datasets: [
      {
        label: "スタッフ別使用量（mL）",
        data: staffValues,
        backgroundColor: "#66cfc4",
      },
    ],
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
        {month} 月の使用量集計（グラフ付きクラウド版）
      </h1>

      {/* 月の合計 */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>💧 月間合計使用量</h2>
        <p>{data.totalMl} mL</p>
        <p>記録件数：{data.records.length} 回</p>
      </div>

      {/* 日別使用量グラフ */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>📈 日別使用量グラフ</h2>
        <Line data={dailyChart} />
      </div>

      {/* スタッフ別使用量グラフ */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>👥 スタッフ別使用量グラフ</h2>
        <Bar data={staffChart} />
      </div>
    </AdminLayout>
  );
}
