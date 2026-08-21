"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("currentStaff");
      if (!raw) {
        router.replace("/login");
        return;
      }

      const loginUser = JSON.parse(raw);
      setUser(loginUser);
    } catch (e) {
      console.error(e);
      router.replace("/login");
    }
  }, []);

  if (user === undefined) {
    return <div>Loading...</div>;
  }

  const menu = [
    { icon: "📝", label: "記録する", path: "/record" },
    { icon: "📚", label: "履歴を見る", path: "/history" },
    { icon: "📊", label: "ランキング", path: "/ranking" },
    { icon: "👤", label: "マイページ", path: "/mypage" },
    ...(user.isAdmin
      ? [{ icon: "🛠️", label: "管理者ページ", path: "/admin" }]
      : []),
    { icon: "🔓", label: "ログイン画面に戻る", path: "/login" },
  ];

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
      <h1
        style={{
          color: "#006b5f",
          marginBottom: "20px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
        }}
      >
        🌱 MAMORU-TE ホーム
      </h1>

      {/* ユーザー情報 */}
      <div style={{ marginBottom: "20px", color: "#006b5f" }}>
        <p>氏名：{user.name}</p>
        <p>部署：{user.department}</p>
        <p>職員番号：{user.staffId}</p>
      </div>

      {/* アイコン付きメニューカード */}
      <div style={{ display: "grid", gap: "14px" }}>
        {menu.map((item, index) => (
          <div
            key={index}
            onClick={() => router.push(item.path)}
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "16px",
              border: "1px solid #cfeeee",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                background: "#cfeeee",
                color: "#006b5f",
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "26px",
              }}
            >
              {item.icon}
            </div>

            <p
              style={{
                margin: 0,
                fontSize: "18px",
                color: "#006b5f",
                fontWeight: "bold",
              }}
            >
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
