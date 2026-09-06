"use client";

import { useEffect, useState } from "react";
import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import BackButton from "@/components/BackButton";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function WardComparePage() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState(null);
  const [mode, setMode] = useState("monthly");

  const wardNameMap = {
    "4f": "4階",
    "5f": "5階",
    "6f": "6階",
    "78f": "7・8階",
    "gairai": "外来",
    "touseki": "透析室",
    "ikyoku": "医局",
    "reha": "リハビリ",
  };

  const wardList = Object.keys(wardNameMap);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const snap = await getDocs(collection(db, "records"));
      const records = snap.docs.map((d) => d.data());

      // 病棟ごとの集計
      const totals = {};

      wardList.forEach((w) => {
        totals[w] = 0;
      });

      records.forEach((r) => {
        const t = r.date.toDate();
        const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);

        if (mode === "monthly") {
          const now = new Date();
          if (
            jst.getFullYear() === now.getFullYear() &&
            jst.getMonth() === now.getMonth()
          ) {
            totals[r.wardId] += Number(r.ml || 0);
          }
        } else {
          totals[r.wardId] += Number(r.ml || 0);
        }
      });

      const labels = wardList.map((w) => wardNameMap[w]);
      const values = wardList.map((w) => totals[w]);

      setChartData({
        labels,
        datasets: [
          {
            label: mode === "monthly" ? "今月の使用量（mL）" : "累計使用量（mL）",
            data: values,
            backgroundColor: "#00a68c",
          },
        ],
      });

      setLoading(false);
    };

    load();
  }, [mode]);

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
      <BackButton to="/admin/ward/6f" />

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
        🏥 病棟ごとの比較グラフ
      </h1>

      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(mode === "monthly")} onClick={() => setMode("monthly")}>
          今月
        </button>
        <button style={tabStyle(mode === "all")} onClick={() => setMode("all")}>
          累計
        </button>
      </div>

      {/* グラフ */}
      <div
        style={{
          background: "#ffffff",
          padding: "16px",
          borderRadius: "16px",
          border: "1px solid #cfeeee",
        }}
      >
        <Bar data={chartData} />
      </div>
    </main>
  );
}
