"use client";

import { useRouter } from "next/navigation";

export default function AdminWardSelect() {
  const router = useRouter();
  const wards = ["6F", "5F", "4F", "3F", "2F", "1F", "外来"];

  return (
    <main style={{
      padding: "20px",
      background: "#F9F9F9",
      minHeight: "100vh",
      fontFamily: "sans-serif"
    }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
        管理者：病棟別ランキング
      </h1>

      <button
        onClick={() => router.push("/admin/ranking")}
        style={backButtonStyle}
      >
        ← ランキングメニューに戻る
      </button>

      {wards.map((ward) => (
        <div
          key={ward}
          onClick={() => router.push(`/admin/ranking/ward/${ward}`)}
          style={menuStyle}
        >
          {ward}
        </div>
      ))}
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
  cursor: "pointer",
  marginBottom: "12px"
};
