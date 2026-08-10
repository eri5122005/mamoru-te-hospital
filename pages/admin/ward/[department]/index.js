"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminHome() {
  const router = useRouter();
  const [loginUser, setLoginUser] = useState({});

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("loginUser") || "{}");
    setLoginUser(saved);
  }, []);

  const wardId = loginUser.wardId;
  const wardName = loginUser.wardName;

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
        🌱 {wardName} の管理ページ
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div onClick={() => router.push(`/admin/ward/${wardId}/stats`)} style={cardStyle}>
          📊 入力率（今日・今月）
        </div>

        <div onClick={() => router.push(`/admin/ward/${wardId}/unrecorded`)} style={cardStyle}>
          ⚠️ 未入力者リスト
        </div>

        <div onClick={() => router.push(`/admin/ward/${wardId}/ranking`)} style={cardStyle}>
          🏅 個人ランキング
        </div>

        <div onClick={() => router.push(`/admin/ward/${wardId}/graph`)} style={cardStyle}>
          📈 使用量推移グラフ
        </div>

        <div onClick={() => router.push(`/admin/ward/${wardId}/staff`)} style={cardStyle}>
          👥 スタッフ一覧
        </div>

        <div onClick={() => router.push("/login")} style={cardStyle}>
          ← ログインページへ戻る
        </div>
      </div>
    </main>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #cfeeee",
  borderRadius: "16px",
  padding: "20px",
  fontSize: "18px",
  color: "#006b5f",
  cursor: "pointer",
  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
};
