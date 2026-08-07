"use client";

import { useRouter } from "next/navigation";

export default function AdminRankingMenu() {
  const router = useRouter();

  return (
    <main style={{
      padding: "20px",
      background: "#F9F9F9",
      minHeight: "100vh",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
        管理者ランキングメニュー
      </h1>

      <button
        onClick={() => router.push("/admin")}
        style={backButtonStyle}
      >
        ← 管理者ホームに戻る
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div
          style={menuStyle}
          onClick={() => router.push("/admin/ranking/ward")}
        >
          🏥 病棟別ランキング
        </div>

        <div
          style={menuStyle}
          onClick={() => router.push("/admin/ranking/personal")}
        >
          👤 個人ランキング（全体）
        </div>
      </div>
    </main>
  );
}

const backButtonStyle = {
  background: "#cfeeee",
  color: "#006b5f",
  border: "none",
  padding: "10px 16px",
  borderRadius: "12px",
  fontSize: "16px",
  cursor: "pointer",
  marginBottom: "20px"
};

const menuStyle = {
  background: "#ffffff",
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid #cfeeee",
  color: "#006b5f",
  fontSize: "18px",
  cursor: "pointer"
};
