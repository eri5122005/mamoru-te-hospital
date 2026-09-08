"use client";

import { useEffect, useState } from "react";
import { db } from "../../../../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRouter } from "next/router";
import BackButton from "@/components/BackButton";

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
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function WardStatsPage() {
  const router = useRouter();
  const { wardId } = router.query;

  const [loading, setLoading] = useState(true);
  const [dailyChart, setDailyChart] = useState(null);
  const [monthlyChart, setMonthlyChart] = useState(null);
  const [mode, setMode] = useState("daily");

  const wardNameMap = {
    "4f": "4階",
    "5f": "5階",
    "6f": "6階",
    "78f": "7・8階",
    "gairai": "外来",
    "touseki": "透析室",
    "ikyoku": "医局",
  };

  useEffect(() => {
    if (!wardId) return;

    const load = async () => {
      setLoading(true);

      const snap = await getDocs(
        query(collection(db, "records"), where("wardId", "==", wardId))
      );

      const records = snap.docs.map((d) => d.data());

      // ★ 日別集計
      const dailyTotals = {};
      records.forEach((r) => {
        const t = r.date.toDate();
        const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);
        const key = jst.toISOString().split("T")[0];

        if (!dailyTotals[key]) dailyTotals[key] = 0;
        dailyTotals[key] += Number(r.ml || 0);
      });

      const dailyLabels = Object.keys(dailyTotals).sort();
      const dailyValues = dailyLabels.map((d) => dailyTotals[d]);

      setDailyChart({
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
      });

      // ★ 月別集計
      const monthlyTotals = {};
      records.forEach((r) => {
        const t = r.date.toDate();
        const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);
        const key = `${jst.getFullYear()}-${jst.getMonth() + 1}`;

        if (!monthlyTotals[key]) monthlyTotals[key] = 0;
        monthlyTotals[key] += Number(r.ml || 0);
      });

      const monthlyLabels = Object.keys(monthlyTotals).sort();
      const monthlyValues = monthlyLabels.map((m) => monthlyTotals[m]);

      setMonthlyChart({
        labels: monthlyLabels,
        datasets: [
          {
            label: "月別使用量（mL）",
            data: monthlyValues,
            borderColor: "#00a68c",
            backgroundColor: "rgba(0, 166, 140, 0.3)",
            tension: 0.3,
            fill: true,
          },
        ],
      });

      setLoading(false);
    };

    load();
  }, [wardId]);

  if (!wardId) return null;
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

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <BackButton to={`/admin/ward/${wardId}`} />

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
        }}
      >
        📊 {wardNameMap[wardId]} 使用量の推移
      </h1>

      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(mode === "daily")} onClick={() => setMode("daily")}>
          日別
        </button>
        <button style={tabStyle(mode === "monthly")} onClick={() => setMode("monthly")}>
          月別
        </button>
      </div>

      {/* グラフ */}
      <div
        style={{
          background: "#ffffff",
          padding: "16px",
          borderRadius: "16px",
          border: "1px solid #cfeeee",
          marginBottom: "20px",
        }}
      >
        {mode === "daily" && dailyChart && <Line data={dailyChart} />}
        {mode === "monthly" && monthlyChart && <Line data={monthlyChart} />}
      </div>

      {/* 数字一覧（日別） */}
      {mode === "daily" && dailyChart && (
        <section>
          <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>日別の数字</h2>

          {dailyChart.labels.map((date, i) => (
            <div
              key={date}
              style={{
                background: "#ffffff",
                border: "1px solid #cfeeee",
                padding: "12px",
                borderRadius: "12px",
                marginBottom: "8px",
              }}
            >
              <strong>{date}</strong>：{dailyChart.datasets[0].data[i].toFixed(1)} mL
            </div>
          ))}
        </section>
      )}

      {/* 数字一覧（月別） */}
      {mode === "monthly" && monthlyChart && (
        <section>
          <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>月別の数字</h2>

          {monthlyChart.labels.map((month, i) => (
            <div
              key={month}
              style={{
                background: "#ffffff",
                border: "1px solid #cfeeee",
                padding: "12px",
                borderRadius: "12px",
                marginBottom: "8px",
              }}
            >
              <strong>{month}</strong>：{monthlyChart.datasets[0].data[i].toFixed(1)} mL
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
