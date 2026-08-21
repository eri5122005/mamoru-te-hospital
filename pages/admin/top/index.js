"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

export default function AdminTop() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const wardId = "ward01"; // ★ あなたの病棟IDに変更

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/ward?id=${wardId}`);
        const json = await res.json();
        setData(json);
        setLoading(false);
      } catch (e) {
        alert("管理者データの取得に失敗しました");
      }
    };

    load();
  }, []);

  if (loading) return <div>読み込み中...</div>;

  const cardStyle = {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    marginBottom: "20px",
    border: "1px solid #cfeeee",
  };

  const titleStyle = {
    color: "#006b5f",
    marginBottom: "12px",
    fontSize: "18px",
    fontWeight: "bold",
  };

  const iconStyle = {
    fontSize: "36px",
    marginBottom: "10px",
    color: "#00a68c",
    textAlign: "center",
  };

  return (
    <AdminLayout>
      <h1
        style={{
          marginBottom: "24px",
          color: "#006b5f",
          textAlign: "center",
        }}
      >
        管理者トップ（クラウド版）
      </h1>

      {/* 今日の状況 */}
      <div style={cardStyle}>
        <div style={iconStyle}>📅</div>
        <h2 style={titleStyle}>今日の状況</h2>
        <p>
  入力率：
  {Math.round(
    ((data.records?.length || 0) / (data.staff?.length || 1)) * 100
  )}
  %
</p>

        <p>総使用量：{data.totalMl} mL</p>
       <p>記録件数：{data.records?.length || 0} 回</p>
<p>未入力者：{data.notEntered?.length || 0} 人</p>

      </div>

      {/* 今月の状況（必要なら後で追加） */}

      {/* 病棟別状況 */}
      <div style={cardStyle}>
        <div style={iconStyle}>🏥</div>
        <h2 style={titleStyle}>病棟別状況</h2>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li style={{ marginBottom: "10px" }}>
            {wardId}：
入力率 {Math.round(((data.records?.length || 0) / (data.staff?.length || 1)) * 100)}%
／ 未入力者 {data.notEntered?.length || 0}人

          </li>
        </ul>
      </div>
    </AdminLayout>
  );
}
