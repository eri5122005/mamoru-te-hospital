"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function RankingPage() {
  const router = useRouter();
  const { department } = router.query;

  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    if (!department) return;

    const allStaff = JSON.parse(localStorage.getItem("staffList") || "[]");

    const filtered = allStaff.filter(
      (s) => s.department === department
    );

    const sorted = filtered.sort((a, b) => b.usage - a.usage);

    setRanking(sorted);
  }, [department]);

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
        }}
      >
        🏅 {department} の個人ランキング
      </h1>

      {ranking.length === 0 && (
        <p style={{ textAlign: "center", color: "#666" }}>
          ランキングデータがありません
        </p>
      )}

      {/* かわいいランキングカード */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {ranking.map((staff, index) => {
          const rank = index + 1;

          const specialStyle =
            rank === 1
              ? { background: "#fff7d1", borderColor: "#ffd700" }
              : rank === 2
              ? { background: "#f0f4ff", borderColor: "#c0c8ff" }
              : rank === 3
              ? { background: "#fff0e6", borderColor: "#ffb38a" }
              : {};

          return (
            <div
              key={staff.id}
              style={{
                background: "#ffffff",
                padding: "18px",
                borderRadius: "16px",
                border: "2px solid #cfeeee",
                boxShadow: "0 3px 6px rgba(0,0,0,0.05)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                ...specialStyle,
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#006b5f",
                  width: "48px",
                  textAlign: "center",
                }}
              >
                {rank}位
              </div>

              <div style={{ flexGrow: 1 }}>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "600",
                    marginBottom: "4px",
                    color: "#006b5f",
                  }}
                >
                  {staff.name}
                </div>
                <div style={{ fontSize: "16px", color: "#555" }}>
                  使用量：{staff.usage} 回
                </div>
              </div>

              <div style={{ fontSize: "24px" }}>
                {rank === 1 && "👑"}
                {rank === 2 && "🥈"}
                {rank === 3 && "🥉"}
                {rank > 3 && "✨"}
              </div>
            </div>
          );
        })}
      </div>

      <div
        onClick={() => router.push(`/admin/ward/${department}`)}
        style={{
          marginTop: "24px",
          background: "#ffffff",
          border: "1px solid #cfeeee",
          borderRadius: "16px",
          padding: "20px",
          fontSize: "18px",
          color: "#006b5f",
          cursor: "pointer",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          textAlign: "center",
        }}
      >
        ← 管理ページに戻る
      </div>
    </main>
  );
}
