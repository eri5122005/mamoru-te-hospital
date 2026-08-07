"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

export default function AdminTop() {
  const [loginUser, setLoginUser] = useState({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("loginUser") || "{}");
    setLoginUser(saved);
    setIsReady(true);
  }, []);

  if (!isReady) {
    return <div>読み込み中...</div>;
  }

  const cardStyle = {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    marginBottom: "20px",
    border: "1px solid #cfeeee",
    boxSizing: "border-box",
  };

  const titleStyle = {
    color: "#006b5f",
    marginBottom: "12px",
    fontSize: "18px",
    fontWeight: "bold",
  };

  const iconStyle = {
    fontSize: "36px",
    marginBottom: "10px",
    color: "#00a68c",
    textAlign: "center",
  };

  return (
    <AdminLayout>
      <h1
        style={{
          marginBottom: "24px",
          color: "#006b5f",
          textAlign: "center",
        }}
      >
        管理者トップ
      </h1>

      {/* 今日の状況カード */}
      <div style={cardStyle}>
        <div style={iconStyle}>📅</div>
        <h2 style={titleStyle}>今日の状況</h2>
        <p>入力率：0%</p>
        <p>総使用量：0 mL</p>
        <p>記録件数：0 回</p>
        <p>未入力者：0 人</p>
      </div>

      {/* 今月の状況カード */}
      <div style={cardStyle}>
        <div style={iconStyle}>📆</div>
        <h2 style={titleStyle}>今月の状況</h2>
        <p>入力率：0%</p>
        <p>総使用量：0 mL</p>
        <p>記録件数：0 回</p>
        <p>未入力者：0 人</p>
      </div>

      {/* 病棟別状況リスト */}
      <div style={cardStyle}>
        <div style={iconStyle}>🏥</div>
        <h2 style={titleStyle}>病棟別状況</h2>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li style={{ marginBottom: "10px" }}>
            6階病棟：入力率 0% ／ 未入力者 0人
          </li>
          <li style={{ marginBottom: "10px" }}>
            5階病棟：入力率 0% ／ 未入力者 0人
          </li>
          <li style={{ marginBottom: "10px" }}>
            外来：入力率 0% ／ 未入力者 0人
          </li>
        </ul>
      </div>
    </AdminLayout>
  );
}
