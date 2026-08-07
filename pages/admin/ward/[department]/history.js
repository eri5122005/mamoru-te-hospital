"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function HistoryPage() {
  const router = useRouter();
  const { department } = router.query;

  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!department) return;

    const records = JSON.parse(localStorage.getItem("records") || "[]");

    // 部署のデータだけ抽出
    const deptRecords = records
      .filter(r => r.department === department)
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // 新しい順

    setHistory(deptRecords);
  }, [department]);

  if (!department) {
    return <p style={{ textAlign: "center", color: "#006b5f" }}>読み込み中…</p>;
  }

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif"
      }}
    >
      <h1
        style={{
          color: "#006b5f",
          textAlign: "center",
          marginBottom: "24px",
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
        📚 {department} 過去データ一覧
      </h1>

      {history.length === 0 && (
        <p style={{ textAlign: "center", color: "#006b5f" }}>
          過去の記録はありません
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {history.map((item, index) => (
          <div
            key={index}
            style={{
              background: "#ffffff",
              border: "1px solid #cfeeee",
              borderRadius: "12px",
              padding: "14px",
              fontSize: "18px",
              color: "#006b5f",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            <div style={{ fontWeight: "600" }}>
              🧴 {item.ml} mL
            </div>
            <div style={{ opacity: 0.8 }}>
              👤 {item.staffId}（スタッフID）
            </div>
            <div style={{ opacity: 0.8 }}>
              📅 {item.date}
            </div>
          </div>
        ))}
      </div>

      <button
        style={{
          background: "#e8f6f6",
          color: "#006b5f",
          padding: "12px 20px",
          borderRadius: "8px",
          border: "none",
          cursor: "pointer",
          marginTop: "24px",
          width: "100%"
        }}
        onClick={() => router.push(`/admin/ward/${department}`)}
      >
        ← 管理ページに戻る
      </button>
    </main>
  );
}
