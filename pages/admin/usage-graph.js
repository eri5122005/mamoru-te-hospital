"use client";

import { useEffect, useState } from "react";
import { Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement
} from "chart.js";

// ★ 円グラフ用の ArcElement を登録
ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, ArcElement);

// ★ 週番号を作る関数
function getWeekNumber(dateStr) {
  const d = new Date(dateStr);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export default function UsageGraph() {
  const [dailyData, setDailyData] = useState(null);
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [deptData, setDeptData] = useState(null);

  useEffect(() => {
    const records = JSON.parse(localStorage.getItem("records") || "[]");
    const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");

    // -------------------------
    // ★ 日別集計
    // -------------------------
    const dailyTotals = {};
    records.forEach(r => {
      if (!dailyTotals[r.date]) dailyTotals[r.date] = 0;
      dailyTotals[r.date] += Number(r.ml);
    });

    const dailyLabels = Object.keys(dailyTotals).sort();
    const dailyValues = dailyLabels.map(d => dailyTotals[d]);

    setDailyData({
      labels: dailyLabels,
      datasets: [
        {
          label: "日別使用量（mL）",
          data: dailyValues,
          borderColor: "#4BB5C1",
          backgroundColor: "rgba(75, 181, 193, 0.3)",
          tension: 0.3,
          fill: true
        }
      ]
    });

    // -------------------------
    // ★ 週別集計
    // -------------------------
    const weeklyTotals = {};
    records.forEach(r => {
      const week = getWeekNumber(r.date);
      if (!weeklyTotals[week]) weeklyTotals[week] = 0;
      weeklyTotals[week] += Number(r.ml);
    });

    const weekLabels = Object.keys(weeklyTotals).sort();
    const weekValues = weekLabels.map(w => weeklyTotals[w]);

    setWeeklyData({
      labels: weekLabels,
      datasets: [
        {
          label: "週別使用量（mL）",
          data: weekValues,
          borderColor: "#4BB5C1",
          backgroundColor: "rgba(75, 181, 193, 0.3)",
          tension: 0.3,
          fill: true
        }
      ]
    });

    // -------------------------
    // ★ 月別集計
    // -------------------------
    const monthlyTotals = {};
    records.forEach(r => {
      const [year, month] = r.date.split("-");
      const ym = `${year}-${month}`;
      if (!monthlyTotals[ym]) monthlyTotals[ym] = 0;
      monthlyTotals[ym] += Number(r.ml);
    });

    const monthLabels = Object.keys(monthlyTotals).sort();
    const monthValues = monthLabels.map(m => monthlyTotals[m]);

    setMonthlyData({
      labels: monthLabels,
      datasets: [
        {
          label: "月別使用量（mL）",
          data: monthValues,
          borderColor: "#4BB5C1",
          backgroundColor: "rgba(75, 181, 193, 0.3)",
          tension: 0.3,
          fill: true
        }
      ]
    });

    // -------------------------
    // ★ 部署別集計（円グラフ用）
    // -------------------------
    const departmentTotals = {};

    records.forEach(r => {
      const staff = staffList.find(s => s.staffId === r.staffId);
      if (!staff) return;

      const dept = staff.department;

      if (!departmentTotals[dept]) departmentTotals[dept] = 0;
      departmentTotals[dept] += Number(r.ml);
    });

    const deptLabels = Object.keys(departmentTotals);
    const deptValues = deptLabels.map(d => departmentTotals[d]);

    setDeptData({
      labels: deptLabels,
      datasets: [
        {
          label: "部署別使用量（mL）",
          data: deptValues,
          backgroundColor: [
            "#4BB5C1",
            "#7CD9C4",
            "#A8E8D9",
            "#CFF5EB",
            "#E8F6F6"
          ],
          borderColor: "#ffffff",
          borderWidth: 2
        }
      ]
    });

  }, []);

  if (!dailyData || !weeklyData || !monthlyData || !deptData) {
    return <p style={{ textAlign: "center" }}>読み込み中…</p>;
  }

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ textAlign: "center", marginBottom: "24px", color: "#006b5f" }}>
        📈 全病棟の使用量グラフ（総合管理者）
      </h1>

      {/* ★ 日別グラフ */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px" }}>
        <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>📅 日別使用量</h2>
        <Line data={dailyData} />
      </div>

      {/* ★ 週別グラフ */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", marginTop: "24px" }}>
        <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>📅 週別使用量</h2>
        <Line data={weeklyData} />
      </div>

      {/* ★ 月別グラフ */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", marginTop: "24px" }}>
        <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>🗓 月別使用量</h2>
        <Line data={monthlyData} />
      </div>

      {/* ★ 部署別比較（円グラフ） */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", marginTop: "24px" }}>
        <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>🏥 部署別比較（円グラフ）</h2>
        <Pie
          data={deptData}
          options={{
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  color: "#006b5f",
                  boxWidth: 20
                }
              }
            }
          }}
        />
      </div>

      <button
        style={{
          marginTop: "24px",
          padding: "12px",
          width: "100%",
          background: "#e8f6f6",
          borderRadius: "8px",
          border: "none",
          color: "#006b5f",
          cursor: "pointer"
        }}
        onClick={() => history.back()}
      >
        ← 戻る
      </button>
    </main>
  );
}
