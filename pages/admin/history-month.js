import { useEffect, useState } from "react";

export default function HistoryMonth() {
  const [month, setMonth] = useState("");
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
    if (!month) return;

    fetch(`/api/admin/history-month?month=${month}`)
      .then(res => res.json())
      .then(data => {
        const sorted = [...data].sort((a, b) => b.total - a.total);
        setList(sorted);
      });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "26px", color: "#006b5f", marginBottom: "20px" }}>
        📅 月ごとの使用量一覧
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

      {list.length === 0 && month && (
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
