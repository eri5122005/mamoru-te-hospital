"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // ★ ログインしていない場合はログインページへ
  useEffect(() => {
    const loginUser = JSON.parse(localStorage.getItem("loginUser"));
    if (!loginUser) {
      router.push("/login");
      return;
    }
    setUser(loginUser);
  }, []);

  if (!user) return null;

  return (
    <main
  style={{
    background: "#F9F9F9",
    minHeight: "100vh",
    padding: "16px",
    fontFamily: "sans-serif",
    maxWidth: "480px",
    margin: "0 auto",
  }}
>

      {/* タイトル */}
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
        MAMORU-TE ホーム
      </h1>

      {/* ★ 氏名・病棟・職員番号を表示 */}
      <div style={{ marginBottom: "20px", color: "#006b5f" }}>
        <p>氏名：{user.name}</p>
        <p>病棟：{user.department}</p>
        <p>職員番号：{user.staffId}</p>
      </div>

      {/* 記録ボタン */}
      <button
        style={buttonStyle}
        onClick={() => router.push("/record")}
      >
        記録する →
      </button>

      {/* 履歴 */}
      <button
        style={buttonStyle}
        onClick={() => router.push("/history")}
      >
        履歴を見る →
      </button>

      {/* ランキング */}
      <button
        style={buttonStyle}
        onClick={() => router.push("/ranking")}
      >
        ランキング →
      </button>

      {/* 管理者だけ表示 */}
      {user.isAdmin && (
        <button
          style={buttonStyle}
          onClick={() => router.push("/admin")}
        >
          管理者ページ →
        </button>
      )}

      {/* ログイン画面へ */}
      <button
        style={buttonStyle}
        onClick={() => router.push("/login")}
      >
        ログイン画面に戻る →
      </button>
    </main>
  );
}

const buttonStyle = {
  padding: "14px",
  background: "#cfeeee",
  border: "none",
  borderRadius: "12px",
  fontSize: "18px",
  color: "#006b5f",
  cursor: "pointer",
  width: "100%",
  marginBottom: "16px",
};

