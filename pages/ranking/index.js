"use client";

import { useRouter } from "next/navigation";

export default function RankingMenu() {
  const router = useRouter();

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        
      }}
    >
      {/* タイトル */}
     <h1
  style={{
    color: "#006b5f",
    textAlign: "center",
    marginBottom: "24px",
    fontSize: "26px",
    fontWeight: "600",
    letterSpacing: "1px",
    padding: "10px 0",
    borderBottom: "3px solid #cfeeee",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px"
  }}
>
  🌱 ランキングメニュー
</h1>




      {/* ホームに戻る */}
      <div
        onClick={() => router.push("/home")}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          padding: "12px 16px",
          borderRadius: "12px",
          cursor: "pointer",
          fontSize: "16px",
          marginBottom: "20px",
          textAlign: "center"
        }}
      >
        ← ホームに戻る
      </div>

      {/* ランキング一覧 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}
      >
        <div onClick={() => router.push("/ranking/usage")} style={mintCard}>
          <span style={iconStyle}>🧴</span>
          使用量ランキング（mL）
        </div>

        <div onClick={() => router.push("/ranking/count")} style={mintCard}>
          <span style={iconStyle}>📝</span>
          記録回数ランキング
        </div>

        <div onClick={() => router.push("/ranking/mint")} style={mintCard}>
          <span style={iconStyle}>🌿</span>
          ミントポイントランキング
        </div>

        <div onClick={() => router.push("/ranking/ward")} style={mintCard}>
          <span style={iconStyle}>🏥</span>
          病棟別ランキング
        </div>

        <div onClick={() => router.push("/ranking/avg")} style={mintCard}>
          <span style={iconStyle}>⏱️</span>
          勤務日数を考慮した平均使用量ランキング
        </div>
      </div>
    </main>
  );
}

/* ミントカードの共通デザイン */
const mintCard = {
  background: "#e8f6f6",
  padding: "16px",
  borderRadius: "16px",
  cursor: "pointer",
  color: "#006b5f",
  fontSize: "18px",
  textAlign: "center",
  border: "1px solid #cfeeee",
  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px"
};

/* アイコンのスタイル */
const iconStyle = {
  fontSize: "22px"
};
