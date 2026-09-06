"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import BackButton from "@/components/BackButton";

export default function WardAdminTop() {
  const router = useRouter();
  const { wardId } = router.query;

  if (!wardId) return null;

  // ★ wardId → 表示名に変換
  const wardNameMap = {
    "4f": "4階",
    "5f": "5階",
    "6f": "6階",
    "78f": "7・8階",
    "gairai": "外来",
    "touseki": "透析室",
    "ikyoku": "医局",
    "reha": "リハビリ",
  };

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      {/* ★ ログイン画面に戻るボタン */}
      <BackButton to="/login" />

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
        }}
      >
        🏥 {wardNameMap[wardId]} 管理者メニュー
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Link href={`/admin/ward/${wardId}/unrecorded`}>
          <div style={menuStyle}>未入力者リスト</div>
        </Link>

        <Link href={`/admin/ward/${wardId}/staff`}>
          <div style={menuStyle}>スタッフ一覧</div>
        </Link>

        <Link href={`/ranking/ward/${wardId}`}>
          <div style={menuStyle}>個人ランキング</div>
        </Link>

        <Link href={`/admin/ward/${wardId}/stats`}>
          <div style={menuStyle}>使用量の推移</div>
        </Link>

        <Link href={`/admin/ward/compare`}>
  <div style={menuStyle}>病棟比較グラフ</div>
</Link>

      </div>
    </main>
  );
}

const menuStyle = {
  background: "#ffffff",
  border: "1px solid #cfeeee",
  borderRadius: "16px",
  padding: "20px",
  textAlign: "center",
  cursor: "pointer",
  color: "#006b5f",
};
