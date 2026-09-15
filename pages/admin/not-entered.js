"use client";

import AdminLayout from "@/components/AdminLayout";
import BackButton from "@/components/BackButton";

export default function AdminNotEnteredPage() {
  return (
    <AdminLayout>
      <BackButton to="/admin" />

      <h1
        style={{
          color: "#006b5f",
          textAlign: "center",
          marginBottom: "20px",
          fontSize: "24px",
          fontWeight: "600",
        }}
      >
        🫧 未入力者ページ（復旧）
      </h1>

      <p style={{ color: "#006b5f", textAlign: "center" }}>
        このページはまだ内容がありません。
      </p>
    </AdminLayout>
  );
}
