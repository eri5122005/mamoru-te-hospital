"use client";

import { useRouter } from "next/navigation";

export default function StaffSettings() {
  const router = useRouter();

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>スタッフ設定</h1>

      <div style={{ background: "white", padding: "20px", borderRadius: "12px" }}>
        <p>スタッフの追加や管理を行います。</p>

        <button
          onClick={() => router.push("/admin/settings/staff/add")}
          style={{
            marginTop: "12px",
            padding: "10px",
            background: "#006b5f",
            color: "white",
            borderRadius: "8px",
            border: "none"
          }}
        >
          スタッフを追加する
        </button>
      </div>

      <button
        onClick={() => router.push("/admin/settings")}
        style={{
          marginTop: "24px",
          padding: "12px",
          width: "100%",
          background: "#e8f6f6",
          borderRadius: "8px",
          border: "none",
          color: "#006b5f",
          cursor: "pointer"
        }}
      >
        ← 設定ページへ戻る
      </button>
    </main>
  );
}
