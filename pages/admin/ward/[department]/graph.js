"use client";

import { Line } from "react-chartjs-2";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

export default function DepartmentGraph() {
  const router = useRouter();
  const { department } = router.query;

  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    if (!department) return;

    const history = JSON.parse(localStorage.getItem("history")) || [];

    const filtered = history.filter(
      (item) => item.department === department
    );

    const dailyMap = {};

    filtered.forEach((item) => {
      const date = item.date;
      const ml = Number(item.ml) || 0;

      if (!dailyMap[date]) dailyMap[date] = 0;
      dailyMap[date] += ml;
    });

    const labels = Object.keys(dailyMap).sort();
    const values = labels.map((d) => dailyMap[d]);

    setChartData({
      labels,
      datasets: [
        {
          label: `${department} の手指消毒量（mL）`,
          data: values,
          borderColor: "#006b5f",
          backgroundColor: "rgba(0, 107, 95, 0.2)",
          tension: 0.3,
          borderWidth: 3,
          pointRadius: 4
        }
      ]
    });
  }, [department]);

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif"
      }}
    >
      <h1
        style={{
          color: "#006b5f",
          textAlign: "center",
          marginBottom: "24px",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px"
        }}
      >
        🌱 {department} 使用量の推移
      </h1>

      {chartData ? (
        <div style={{ background: "#fff", padding: "16px", borderRadius: "12px" }}>
          <Line data={chartData} />
        </div>
      ) : (
        <p style={{ textAlign: "center", color: "#006b5f" }}>
          データを読み込み中…
        </p>
      )}

      {/* ← 統計ページに戻るボタン（確実に動く） */}
      {department && (
        <button
          style={{
            background: "#4BB5C1",
            color: "white",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            marginTop: "20px",
          }}
          onClick={() => router.push(`/admin/ward/${department}`)}

        >
          ←管理ページに戻る 
        </button>
      )}
    </main>
  );
}
