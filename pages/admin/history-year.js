"use client";

import { useEffect, useState } from "react";
import BackButton from "@/components/BackButton";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx"; // ★ Excel出力ライブラリ追加

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Legend,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Legend, Tooltip);

// ★ 病棟ID → 表示名
const wardNameMap = {
  "4f": "4階",
  "5f": "5階",
  "6f": "6階",
  "78f": "7・8階",
  "gairai": "外来",
  "touseki": "透析室",
  "riha": "リハビリ",
  "ikyoku": "医局",
  "shisetsu": "施設管理",
};

// ★ 病棟ID → 色
const wardColors = {
  "4f": "#006b5f",
  "5f": "#00a89b",
  "6f": "#26a69a",
  "78f": "#80cbc4",
  "gairai": "#4fc3f7",
  "touseki": "#ef5350",
  "riha": "#9575cd",
  "ikyoku": "#ffb74d",
  "shisetsu": "#8d6e63",
};

export default function HistoryYear() {
  const [year, setYear] = useState("");
  const [monthlyTotals, setMonthlyTotals] = useState({});
  const [wardTotals, setWardTotals] = useState({});

  // ★ 年リスト（2020〜2030）
  const years = Array.from({ length: 11 }, (_, i) => 2020 + i);

  const loadData = async () => {
    if (!year) return;

    const recSnap = await getDocs(collection(db, "records"));
    const records = recSnap.docs.map(doc => doc.data());

    const monthly = {};
    const wards = {};

    records.forEach(item => {
      const t = item.date.toDate();
      const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);

      const y = jst.getFullYear();
      if (String(y) !== String(year)) return;

      const key = `${year}-${jst.getMonth() + 1}`;

      const ward = item.wardId || "不明";

      if (!monthly[key]) monthly[key] = 0;
      monthly[key] += Number(item.ml || 0);

      if (!wards[ward]) wards[ward] = {};
      if (!wards[ward][key]) wards[ward][key] = 0;
      wards[ward][key] += Number(item.ml || 0);
    });

    setMonthlyTotals(monthly);
    setWardTotals(wards);
  };

  // ★ CSV（院内）
  const downloadYearTotalCSV = () => {
    const header = "month,total\n";
    const rows = Object.keys(monthlyTotals)
      .map(key => `${key},${monthlyTotals[key]}`)
      .join("\n");

    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${year}-monthly-total.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  // ★ CSV（部署別）
  const downloadYearWardCSV = () => {
    const wards = Object.keys(wardTotals);
    const header = "month," + wards.join(",") + "\n";

    const rows = Object.keys(monthlyTotals)
      .map(key => {
        const cols = wards.map(w => wardTotals[w][key] || 0);
        return `${key},${cols.join(",")}`;
      })
      .join("\n");

    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${year}-ward-monthly.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  // ★ Excel（院内）
  const downloadYearTotalXLSX = () => {
    const rows = Object.keys(monthlyTotals).map(key => ({
      month: key,
      total: monthlyTotals[key],
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "院内月次");

    XLSX.writeFile(wb, `${year}-monthly-total.xlsx`);
  };

  // ★ Excel（部署別）
  const downloadYearWardXLSX = () => {
    const wards = Object.keys(wardTotals);

    const rows = Object.keys(monthlyTotals).map(key => {
      const row = { month: key };
      wards.forEach(w => {
        row[wardNameMap[w] || w] = wardTotals[w][key] || 0;
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "部署別月次");

    XLSX.writeFile(wb, `${year}-ward-monthly.xlsx`);
  };

  const labels = Object.keys(monthlyTotals);

  const totalData = {
    labels,
    datasets: [
      {
        label: "院内使用量（mL）",
        data: Object.values(monthlyTotals),
        borderColor: "#00a89b",
        backgroundColor: "rgba(0,168,155,0.2)",
        tension: 0.3,
      },
    ],
  };

  const wardData = {
    labels,
    datasets: Object.keys(wardTotals).map((ward) => ({
      label: wardNameMap[ward] || ward,
      data: labels.map(label => wardTotals[ward][label] || 0),
      borderColor: wardColors[ward] || "#888",
      backgroundColor: (wardColors[ward] || "#888") + "33",
      tension: 0.3,
    })),
  };

  return (
    <div style={{ padding: "20px", maxWidth: "480px", margin: "0 auto" }}>
      <BackButton to="/admin" />

      <h1 style={{ fontSize: "26px", color: "#006b5f", marginBottom: "20px", textAlign: "center" }}>
        📅 年ごとの使用量
      </h1>

      {/* ★ 年プルダウン */}
      <div style={{ marginBottom: "20px" }}>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          style={{
            padding: "10px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #cfeeee",
            width: "140px",
          }}
        >
          <option value="">選択してください</option>
          {years.map(y => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>

        <button
          onClick={loadData}
          style={{
            marginLeft: "10px",
            padding: "10px 14px",
            background: "#006b5f",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          読み込む
        </button>
      </div>

     {/* ★ CSV & Excel ボタン（2列グリッド＋余白広め） */}
<div
  style={{
    marginBottom: "24px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr", // ← 2列にする
    gap: "12px", // ← ボタン同士の間隔
  }}
>
  <button
    onClick={downloadYearTotalCSV}
    style={{
      padding: "12px",
      background: "#009688",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      width: "100%",
    }}
  >
    院内（月次）CSV
  </button>

  <button
    onClick={downloadYearWardCSV}
    style={{
      padding: "12px",
      background: "#4fc3f7",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      width: "100%",
    }}
  >
    部署別（月次）CSV
  </button>

  <button
    onClick={downloadYearTotalXLSX}
    style={{
      padding: "12px",
      background: "#00796b",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      width: "100%",
    }}
  >
    院内（月次）Excel
  </button>

  <button
    onClick={downloadYearWardXLSX}
    style={{
      padding: "12px",
      background: "#26a69a",
      color: "#fff",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      width: "100%",
    }}
  >
    部署別（月次）Excel
  </button>
</div>

      {/* 院内合計 */}
      <div
        style={{
          background: "#E8F8F6",
          padding: "16px",
          borderRadius: "12px",
          marginBottom: "20px",
          border: "1px solid #cfeeee",
        }}
      >
        <h2 style={{ color: "#006b5f", fontSize: "20px", marginBottom: "10px" }}>
          💧 院内合計（年）
        </h2>
        <Line data={totalData} />
      </div>

      {/* 病棟別 */}
      <div
        style={{
          background: "#F0F4F8",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #cfeeee",
        }}
      >
        <h2 style={{ color: "#006b5f", fontSize: "20px", marginBottom: "10px" }}>
          🏥 病棟別（年）
        </h2>
        <Line data={wardData} />
      </div>
    </div>
  );
}
