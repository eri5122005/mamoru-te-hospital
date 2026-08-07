"use client";

import AdminLayout from "@/components/AdminLayout";

export default function WardRate() {
  const cardStyle = {
    background: "#e8f6f6", // ミント背景
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
    border: "2px solid #aeece4", // ミント枠
    boxSizing: "border-box",
  };

  const titleStyle = {
    color: "#00a68c", // ミントタイトル
    marginBottom: "12px",
    fontSize: "20px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const iconStyle = {
    fontSize: "28px",
  };

  return (
    <AdminLayout>
      <h1
        style={{
          marginBottom: "24px",
          color: "#00a68c",
          textAlign: "center",
        }}
      >
        今日・今月の入力率
      </h1>

      {/* 今日の入力率カード */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>
          <span style={iconStyle}>📅</span> 今日の入力率
        </h2>

        <p>入力率：0%</p>
        <p>入力したスタッフ：0人</p>
        <p>全スタッフ数：0人</p>
      </div>

      {/* 今月の入力率カード */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>
          <span style={iconStyle}>📆</span> 今月の入力率
        </h2>

        <p>入力率：0%</p>
        <p>入力したスタッフ：0人</p>
        <p>全スタッフ数：0人</p>
      </div>

      {/* 病棟別入力率リスト */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>
          <span style={iconStyle}>🏥</span> 病棟別入力率
        </h2>

        <ul style={{ listStyle: "none", padding: 0 }}>
          <li style={{ marginBottom: "10px" }}>6階病棟：入力率 0%</li>
          <li style={{ marginBottom: "10px" }}>5階病棟：入力率 0%</li>
          <li style={{ marginBottom: "10px" }}>外来：入力率 0%</li>
        </ul>
      </div>
    </AdminLayout>
  );
}
