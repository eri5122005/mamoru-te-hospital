import { useEffect, useState } from "react";

export default function TodayWardRate() {
  const [wardRate, setWardRate] = useState([]);

  useEffect(() => {
    fetch("/api/admin/ward-rate")
      .then(res => res.json())
      .then(data => {
        // 入力率の高い順に並べる
        const sorted = [...data].sort((a, b) => b.rate - a.rate);
        setWardRate(sorted);
      });
  }, []);

  const Card = {
    background: "#E8F8F6",
    padding: "16px",
    borderRadius: "12px",
    marginBottom: "12px",
    border: "1px solid #cfeeee",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  };

  const WardName = {
    fontSize: "20px",
    fontWeight: "600",
    color: "#006b5f",
  };

  const Sub = {
    fontSize: "14px",
    color: "#555",
    marginTop: "4px",
  };

  const Rate = {
    fontSize: "26px",
    fontWeight: "700",
    marginTop: "6px",
    color: "#006b5f",
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "26px", color: "#006b5f", marginBottom: "20px" }}>
        📊 病棟別入力率
      </h1>

      {wardRate.length === 0 && (
        <div>データがありません。</div>
      )}

      {wardRate.map((ward, index) => (
        <div key={index} style={Card}>
          <div style={WardName}>{ward.wardName}</div>
          <div style={Rate}>{ward.rate}%</div>
          <div style={Sub}>
            入力者 {ward.usedCount ?? "?"} / スタッフ総数 {ward.totalCount ?? "?"}
          </div>
        </div>
      ))}
    </div>
  );
}
