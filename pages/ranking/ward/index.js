"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function WardRanking() {
  const router = useRouter();
  const [data, setData] = useState([]);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("history")) || [];

    const wardMap = {};

    history.forEach((item) => {
      const ward = item.department || "不明";
      const ml = Number(item.ml) || 0;

      if (!wardMap[ward]) wardMap[ward] = 0;
      wardMap[ward] += ml;
    });

    const ranking = Object.entries(wardMap)
      .map(([ward, total]) => ({ ward, total }))
      .sort((a, b) => b.total - a.total);

    setData(ranking);
  }, []);

  return (
    <main
      style={{
        padding: "20px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif"
      }}
    >

      {/* ★ ここにミントの戻るボタンを追加 */}
      <button
        onClick={() => router.push("/ranking")}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "20px",
          width: "100%"
        }}
      >
        ← ランキングメニューに戻る
      </button>

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
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
        🌱 病棟別ランキング
      </h1>

      {data.map((item, index) => (
        <div
          key={index}
          style={{
            background: "#e8f6f6",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "12px",
            border: "1px solid #cfeeee",
            color: "#006b5f",
            fontSize: "18px"
          }}
        >
          {index + 1}位：{item.ward}（{item.total} mL）
        </div>
      ))}
    </main>
  );
}
