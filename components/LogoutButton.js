"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <div
      onClick={() => {
        localStorage.removeItem("loginUser");
        router.push("/login");   // ← ここを修正！
      }}
      style={{
        marginTop: "24px",
        padding: "14px",
        background: "#ffdddd",
        borderRadius: "12px",
        cursor: "pointer",
        color: "#a33",
        textAlign: "center",
        fontSize: "18px",
      }}
    >
      ログアウト
    </div>
  );
}

