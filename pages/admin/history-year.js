import { useState } from "react";

export default function HistoryYear() {
  const [year, setYear] = useState("");
  const [list, setList] = useState([]);

  const Card = {
    background: "#E8F8F6",
    padding: "16px",
    borderRadius: "12px",
    marginBottom: "12px",
    border: "1px solid #cfeeee",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  };

  const Name = {
    fontSize: "20px",
    fontWeight: "600",
    color: "#006b5f",
  };

  const Sub = {
    fontSize: "14px",
    color: "#555",
    marginTop: "4px",
  };

  const loadData = () => {
    if (!year) return;

    fetch(`/api/admin/history-year?year=${year}`)
      .then(res => res.json())
      .then(data => {
        const sorted = [...data].sort((a, b) => b.total - a.total);
        setList(sorted);
      });
  };

  const downloadCSV = () => {
    if (list.length === 0) return;

    const header = "staffId,name,wardId,total\n";
    const rows = list
      .map(item => `${item.staffId},${item.name},${item.wardId},${item.total}`)
      .join("\n");

    const csv = header + rows;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${year}-history.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "26px", color: "#006b5f", marginBottom: "20px" }}>
        📅 年ごとの使用量一覧
      </h1>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="2026"
          style={{
            padding: "10px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #cfeeee",
            width: "120px",
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

        <button
          onClick={downloadCSV}
          style={{
            marginLeft: "10px",
            padding: "10px 14px",
            background: "#009688",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          CSVダウンロード
        </button>
      </div>

      {list.length === 0 && year && (
        <div>データがありません。</div>
      )}

      {list.map((item, index) => (
        <div key={index} style={Card}>
          <div style={Name}>{item.name}</div>
          <div style={Sub}>病棟: {item.wardId}</div>
          <div style={{ fontSize: "16px", marginTop: "6px" }}>
            {Number(item.total).toFixed(2)} mL
          </div>
        </div>
      ))}
    </div>
  );
}
