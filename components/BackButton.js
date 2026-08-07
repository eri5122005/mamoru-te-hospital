"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ to = "/admin" }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(to)}
      style={{
        marginTop: "24px",
        padding: "14px",
        background: "#e8f6f6",
        borderRadius: "12px",
        cursor: "pointer",
        color: "#006b5f",
        textAlign: "center",
        fontSize: "18px",
      }}
    >
      ← 戻る
    </div>
  );
}
