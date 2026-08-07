"use client";

import { useRouter } from "next/navigation";

export default function RankingHeader({ title }) {
  const router = useRouter();

  return (
    <div
      style={{
        marginBottom: "20px",
        paddingBottom: "10px",
        borderBottom: "1px solid #cfeeee"
      }}
    >
      <button
        onClick={() => router.push("/ranking")}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "12px"
        }}
      >
        ← ランキングメニューに戻る
      </button>

      <h1 style={{ color: "#006b5f", margin: 0 }}>{title}</h1>
    </div>
  );
}
