"use client";

import { useState } from "react";
import BackButton from "@/components/BackButton";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx"; // ★ Excel出力ライブラリ

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

// 病棟名マップ
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

// 色マップ
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

export default function HistoryMonth() {
  const [month, setMonth] = useState(""); // 2026-09
  const [dailyTotals, setDailyTotals] = useState({});
  const [wardDailyTotals, setWardDailyTotals] = useState({});

 const loadData = async () => {
  if (!month) return;

  const recSnap = await getDocs(collection(db, "records"));
  const records = recSnap.docs.map(doc => doc.data());

  const daily = {};
  const wardDaily = {};
// ★ 全日を強制初期化（1〜31日）
for (let d = 1; d <= 31; d++) {
  daily[d] = 0;
}

  // ★ 全部署を強制初期化
  const allWards = Object.keys(wardNameMap);
  allWards.forEach(w => {
    wardDaily[w] = {};
    for (let d = 1; d <= 31; d++) {
      wardDaily[w][d] = 0;
    }
  });

  // ★ 入力があった部署を上書きして集計
  records.forEach(item => {
    const t = item.date.toDate();
    const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);
    const day = jst.getDate();

    const ward = item.wardId || "不明";

    if (!wardDaily[ward]) {
      wardDaily[ward] = {};
      for (let d = 1; d <= 31; d++) {
        wardDaily[ward][d] = 0;
      }
    }

    wardDaily[ward][day] += Number(item.ml || 0);
  });

  setDailyTotals(daily);
  setWardDailyTotals(wardDaily);
}   // ← ★ ここはセミコロン無し

  // CSV（院内）
  const downloadDailyCSV = () => {
    const header = "day,total\n";
    const rows = Object.keys(dailyTotals)
      .map(day => `${day},${dailyTotals[day]}`)
      .join("\n");

    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${month}-daily-total.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  // CSV（部署別）
  const downloadWardCSV = () => {
    const wards = Object.keys(wardDailyTotals);

    const header = "day," + wards.join(",") + "\n";

    const rows = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const cols = wards.map(w => wardDailyTotals[w][day] || 0);
      return `${day},${cols.join(",")}`;
    }).join("\n");

    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${month}-ward-daily.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  // ★ Excel（院内）
  const downloadDailyXLSX = () => {
    const rows = Object.keys(dailyTotals).map(day => ({
      day,
      total: dailyTotals[day],
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "院内日次");

    XLSX.writeFile(wb, `${month}-daily-total.xlsx`);
  };

  // ★ Excel（部署別）
  const downloadWardXLSX = () => {
    const wards = Object.keys(wardDailyTotals);

    const rows = Array.from({ length: 31 }, (_, i) => {
      const day = i + 1;
      const row = { day };
      wards.forEach(w => {
        row[wardNameMap[w] || w] = wardDailyTotals[w][day] || 0;
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "部署別日次");

    XLSX.writeFile(wb, `${month}-ward-daily.xlsx`);
  };

  const labels = Object.keys(dailyTotals).map(d => `${month}-${d}`);

  const totalData = {
    labels,
    datasets: [
      {
        label: "院内使用量（日次）",
        data: Object.values(dailyTotals),
        borderColor: "#00a89b",
        backgroundColor: "rgba(0,168,155,0.2)",
        tension: 0.3,
      },
    ],
  };

  const wardData = {
    labels,
    datasets: Object.keys(wardDailyTotals).map((ward) => ({
      label: wardNameMap[ward] || ward,
      data: labels.map(label => {
        const day = Number(label.split("-")[2]);
        return wardDailyTotals[ward][day] || 0;
      }),
      borderColor: wardColors[ward] || "#888",
      backgroundColor: (wardColors[ward] || "#888") + "33",
      tension: 0.3,
    })),
  };
   
 const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true, // ★ 0を必ず下に固定
      min: 0,            // ★ マイナス領域を完全に消す
    },
  },
};

  return (
    <div style={{ padding: "20px", maxWidth: "480px", margin: "0 auto" }}>
      <BackButton to="/admin" />

<h1 style={{ fontSize: "26px", color: "#006b5f", marginBottom: "20px", textAlign: "center" }}>
  📊 月ごとの使用量<br />（日次推移）
</h1>


      <div style={{ marginBottom: "20px" }}>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            padding: "10px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #cfeeee",
          }}
        />
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

      {/* ★ CSV & Excel ボタン（2列グリッド） */}
      <div
        style={{
          marginBottom: "24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}
      >
        <button
          onClick={downloadDailyCSV}
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
          院内（日次）CSV
        </button>

        <button
          onClick={downloadWardCSV}
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
          部署別（日次）CSV
        </button>

        <button
          onClick={downloadDailyXLSX}
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
          院内（日次）Excel
        </button>

        <button
          onClick={downloadWardXLSX}
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
          部署別（日次）Excel
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
          💧 院内合計（日次）
        </h2>
        <div style={{ width: "100%" }}>
          <Line data={totalData} options={chartOptions} />
        </div>
      </div>


            {/* 部署別 */}
      <div
        style={{
          background: "#F0F4F8",
          padding: "16px",
          borderRadius: "12px",
          border: "1px solid #cfeeee",
        }}
      >
        <h2 style={{ color: "#006b5f", fontSize: "20px", marginBottom: "10px" }}>
          🏥 部署別（日次）
        </h2>
        <div style={{ width: "100%" }}>
          <Line data={wardData} options={chartOptions} />
        </div>
      </div>

      <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  }}
>
  {Object.keys(wardDailyTotals).map((ward) => (
    <div
      key={ward}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        background: "#fff",
        borderRadius: "6px",
        border: "1px solid #cfeeee",
      }}
    >
      <div
        style={{
          width: "12px",
          height: "12px",
          background: wardColors[ward] || "#888",
          borderRadius: "3px",
        }}
      />
      <span style={{ fontSize: "14px", color: "#006b5f" }}>
        {wardNameMap[ward] || ward}
      </span>
    </div>
  ))}
</div>


    </div>
  );
}
