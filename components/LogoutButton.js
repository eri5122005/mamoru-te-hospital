"use client";

import { clearRecordDraft } from "../utils/recordUpdateDraft";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <div
      onClick={() => {
        try { clearRecordDraft(sessionStorage); } catch { /* Login and startup also guard drafts. */ }
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

