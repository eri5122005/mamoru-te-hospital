"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import BackButton from "@/components/BackButton";

export default function WardAdminTop() {
  const router = useRouter();
  const { wardId, from } = router.query;

  const backTo = from === "admin" ? "/admin/ward" : "/login";

  if (!wardId) return null;

  const wardNameMap = {
    "4f": "4階",
    "5f": "5階",
    "6f": "6階",
    "78f": "7・8階",
    "gairai": "外来",
    "touseki": "透析室",
    "ikyoku": "医局",
    "reha": "リハビリ",
    "shisetsu": "施設管理",   // ★ 追加
  };

  const innerRow = {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    paddingLeft: "20px",
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
      <BackButton to={backTo} />

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
          <div style={menuStyle}>
            <div style={innerRow}>
              <span style={{ fontSize: "28px" }}>👤</span>
              <span>未入力者リスト</span>
            </div>
          </div>
        </Link>

        <Link href={`/admin/ward/${wardId}/staff`}>
          <div style={menuStyle}>
            <div style={innerRow}>
              <span style={{ fontSize: "28px" }}>👥</span>
              <span>スタッフ一覧</span>
            </div>
          </div>
        </Link>

        <Link href={`/ranking/ward/${wardId}`}>
          <div style={menuStyle}>
            <div style={innerRow}>
              <span style={{ fontSize: "28px" }}>💧</span>
              <span>個人ランキング</span>
            </div>
          </div>
        </Link>

        {/* ★ 勤務日数を考慮した平均使用量ランキング */}
        <Link href={`/admin/ward/${wardId}/avg-ranking`}>
          <div style={menuStyle}>
            <div style={innerRow}>
              <span style={{ fontSize: "28px" }}>📈</span>
              <span>平均使用量ランキング</span>
            </div>
          </div>
        </Link>

        <Link href={`/admin/ward/${wardId}/stats`}>
          <div style={menuStyle}>
            <div style={innerRow}>
              <span style={{ fontSize: "28px" }}>📊</span>
              <span>使用量の推移</span>
            </div>
          </div>
        </Link>

        <Link href={`/admin/ward/compare`}>
          <div style={menuStyle}>
            <div style={innerRow}>
              <span style={{ fontSize: "28px" }}>✨</span>
              <span>病棟比較グラフ</span>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}

const menuStyle = {
  background: "#DFF7F2",
  border: "1px solid #cfeeee",
  borderRadius: "16px",
  padding: "20px",
  cursor: "pointer",
  color: "#2AAE9E",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
};
