"use client";

import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";

export default function StaffDetail() {
  const router = useRouter();
  const { id } = router.query;

  const cardStyle = {
    background: "#e8f6f6", // ミント背景
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
    border: "2px solid #aeece4", // ミント枠
  };

  const titleStyle = {
    color: "#00a68c", // ミントタイトル
    marginBottom: "12px",
    fontSize: "20px",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const iconStyle = {
    fontSize: "28px",
  };

  return (
    <AdminLayout>
      <h1
        style={{
          color: "#00a68c",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        スタッフ詳細ページ
      </h1>

      <div style={cardStyle}>
        <h2 style={titleStyle}>
          <span style={iconStyle}>👤</span> スタッフID：{id}
        </h2>

        <p>名前：ここに名前を入れる</p>
        <p>所属：ここに病棟を入れる</p>
        <p>今月の使用量：0 mL</p>
        <p>記録回数：0 回</p>
      </div>
    </AdminLayout>
  );
}
