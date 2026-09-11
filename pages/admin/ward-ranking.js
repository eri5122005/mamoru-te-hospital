import { useEffect, useState } from "react";

export default function WardRanking() {
  const [ranking, setRanking] = useState([]);
  const [mode, setMode] = useState("today"); // today / week / month / year

  useEffect(() => {
    fetch(`/api/admin/ranking-${mode}`)
      .then(res => res.json())
      .then(data => {
        const sorted = [...data].sort((a, b) => b.total - a.total);
        setRanking(sorted);
      });
  }, [mode]);

  const Card = {
    background: "#E8F8F6",
    padding: "16px",
    borderRadius: "12px",
    marginBottom: "12px",
    border: "1px solid #cfeeee",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  };

  const ModeButton = (active) => ({
    padding: "10px 14px",
    marginRight: "8px",
    borderRadius: "8px",
    border: "none",
    background: active ? "#006b5f" : "#cfeeee",
    color: active ? "#fff" : "#006b5f",
    cursor: "pointer",
    fontSize: "16px",
  });

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "26px", color: "#006b5f", marginBottom: "20px" }}>
        🏥 病棟別ランキング
      </h1>

      {/* 切り替えボタン */}
      <div style={{ marginBottom: "20px" }}>
        <button style={ModeButton(mode === "today")} onClick={() => setMode("today")}>今日</button>
        <button style={ModeButton(mode === "week")} onClick={() => setMode("week")}>週</button>
        <button style={ModeButton(mode === "month")} onClick={() => setMode("month")}>月</button>
        <button style={ModeButton(mode === "year")} onClick={() => setMode("year")}>年</button>
      </div>

      {ranking.length === 0 && (
        <div>データがありません。</div>
      )}

      {ranking.map((ward, index) => (
        <div key={index} style={Card}>
          <div style={{ fontSize: "22px", fontWeight: "700", color: "#006b5f" }}>
            {index + 1}位
          </div>
          <div style={{ fontSize: "18px", fontWeight: "600" }}>
            {ward.wardName}
          </div>
          <div style={{ fontSize: "20px", fontWeight: "700", marginTop: "6px", color: "#006b5f" }}>
            {Number(ward.total).toFixed(2)} mL
          </div>
        </div>
      ))}
    </div>
  );
}
