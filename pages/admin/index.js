"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function AdminHome() {
  const router = useRouter();

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
    background: "#e8f6f6", // ★ ミント背景に変更
    borderRadius: "20px",
    padding: "24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "0.2s",
    border: "2px solid #aeece4", // ★ ミント枠を追加
  };

  const iconStyle = {
    fontSize: "40px",
    marginBottom: "12px",
    color: "#00a68c", // ★ ミントアイコン
  };

  return (
    <main
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "24px",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          color: "#00a68c", // ★ タイトルもミントに
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        総合管理メニュー
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "20px",
        }}
      >
        <div style={cardStyle} onClick={() => router.push("/admin/top")}>
          <div style={iconStyle}>📊</div>
          <p>管理者トップ</p>
        </div>

        <div style={cardStyle} onClick={() => router.push("/admin/ward-rate")}>
          <div style={iconStyle}>📈</div>
          <p>今日・今月の入力率</p>
        </div>

        <div
          style={cardStyle}
          onClick={() => router.push("/admin/ward-missing")}
        >
          <div style={iconStyle}>🔍</div>
          <p>未入力者一覧</p>
        </div>

        <div
          style={cardStyle}
          onClick={() => router.push("/admin/staff-list")}
        >
          <div style={iconStyle}>👥</div>
          <p>スタッフ一覧</p>
        </div>

        <div style={cardStyle} onClick={() => router.push("/admin/ranking")}>
          <div style={iconStyle}>🏅</div>
          <p>個人ランキング</p>
        </div>

        <div
          style={cardStyle}
          onClick={() => router.push("/admin/usage-graph")}
        >
          <div style={iconStyle}>📉</div>
          <p>使用量グラフ</p>
        </div>

        <div style={cardStyle} onClick={() => router.push("/admin/settings")}>
          <div style={iconStyle}>⚙</div>
          <p>設定ページへ</p>
        </div>

        <div style={cardStyle} onClick={() => router.push("/login")}>
          <div style={iconStyle}>🚪</div>
          <p>ログインページへ戻る</p>
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <LogoutButton />
      </div>
    </main>
  );
}


