import { useEffect, useState } from "react";

export default function NotInputToday() {
  const [list, setList] = useState([]);

  useEffect(() => {
    fetch("/api/admin/not-input-today")
      .then(res => res.json())
      .then(data => setList(data));
  }, []);

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

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "26px", color: "#006b5f", marginBottom: "20px" }}>
        🚫 今日の未入力者
      </h1>

      {list.length === 0 && (
        <div>全員入力済みです。</div>
      )}

      {list.map((s, index) => (
        <div key={index} style={Card}>
          <div style={Name}>{s.name}</div>
          <div style={Sub}>病棟: {s.wardId}</div>
        </div>
      ))}
    </div>
  );
}
