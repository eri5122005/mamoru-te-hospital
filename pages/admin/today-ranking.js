import { useEffect, useState } from "react";

export default function TodayRanking() {
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    fetch("/api/admin/today-ranking")
      .then(res => res.json())
      .then(data => setRanking(data));
  }, []);

  const Card = {
    background: "#E8F8F6",
    padding: "16px",
    borderRadius: "12px",
    marginBottom: "12px",
    border: "1px solid #cfeeee",
    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
  };

  const RankNum = {
    fontSize: "22px",
    fontWeight: "700",
    color: "#006b5f",
  };

  const Name = {
    fontSize: "18px",
    fontWeight: "600",
    marginTop: "4px",
  };

  const Sub = {
    fontSize: "14px",
    color: "#555",
    marginTop: "2px",
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ fontSize: "26px", color: "#006b5f", marginBottom: "20px" }}>
        🧴 今日の入力者ランキング
      </h1>

      {ranking.length === 0 && (
        <div>今日の入力者はまだいません。</div>
      )}

      {ranking.map((staff, index) => (
        <div key={index} style={Card}>
          <div style={RankNum}>{index + 1}位</div>
          <div style={Name}>{staff.name}</div>
          <div style={Sub}>{staff.wardName}</div>
          <div style={Sub}>今日の使用量：{staff.amount} mL</div>
          {staff.time && <div style={Sub}>入力時刻：{staff.time}</div>}
        </div>
      ))}
    </div>
  );
}
