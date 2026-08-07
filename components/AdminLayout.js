"use client";

import BackButton from "@/components/BackButton";

export default function AdminLayout({ children }) {
  return (
    <main style={{ background: "#F9F9F9", minHeight: "100vh", padding: "24px" }}>
      {children}

      {/* 全ページ共通の戻るボタン */}
      <BackButton to="/admin" />
    </main>
  );
}
