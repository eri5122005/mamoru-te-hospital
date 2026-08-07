"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function WardRankingPage() {
  const router = useRouter();
  const { department } = router.query;

  const [ranking, setRanking] = useState([]);


  useEffect(() => {
    if (!department) return;

    const history = JSON.parse(localStorage.getItem("history")) || [];

    // 部署でフィルタ
    const wardHistory = history.filter(
      (item) => item.department === department
    );

    // staffId ごとに集計（使用量と記録回数）
    const staffMap = {};
    wardHistory.forEach((item) => {
      if (!staffMap[item.staffId]) {
        staffMap[item.staffId] = {
          staffId: item.staffId,
          name: item.name,
          totalMl: 0,
          count: 0,
        };
      }
      staffMap[item.staffId].totalMl += Number(item.ml);
      staffMap[item.staffId].count += 1;
    });

    // ランキング化（使用量で並べ替え）
    const sorted = Object.values(staffMap).sort(
      (a, b) => b.totalMl - a.totalMl
    );

    setRanking(sorted);
  }, [department]);

  if (!department) return <p>読み込み中…</p>;

  return (
   <main
  style={{
    padding: "20px",
    background: "#F9F9F9",
    minHeight: "100vh",
    fontFamily: "sans-serif",
  }}
>
  <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
    {department} の個人ランキング（使用量）
  </h1>

      {/* 戻るボタン */}
    <button
  onClick={() => router.push(`/admin/ward/${department}`)}
  style={{
    background: "#cfeeee",
    color: "#006b5f",
    border: "none",
    padding: "10px 16px",
    borderRadius: "12px",
    fontSize: "16px",
    cursor: "pointer",
    marginBottom: "20px",
  }}
>
  ← 部署管理ページに戻る
</button>




      {/* かわいいランキングUI */}
      {ranking.map((item, index) => (
  <div
    key={item.staffId}
    style={{
      background: index === 0 ? "#e6faf7" : "#ffffff",
      padding: "20px",
      borderRadius: "16px",
      marginBottom: "16px",
      border: "1px solid #cfeeee",
      display: "flex",
      alignItems: "center",
      gap: "16px"
    }}
  >
    <div
      style={{
        background: index === 0 ? "#00a89d" : "#cfeeee",
        color: "#ffffff",
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: "bold"
      }}
    >
      {index + 1}
    </div>

    <div style={{ color: "#006b5f" }}>
      <h3 style={{ margin: "0 0 6px 0" }}>
        {item.name}（{item.staffId}）
      </h3>
      <p style={{ margin: 0 }}>記録回数：{item.count} 回</p>
      <p style={{ margin: 0 }}>
        合計使用量：{item.totalMl.toFixed(1)} mL
      </p>
    </div>
  </div>
))}

    </main>
  );
}

