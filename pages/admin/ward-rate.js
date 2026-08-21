"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

export default function WardRatePage() {
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
        alert("入力率データの取得に失敗しました");
      }
    };

    load();
  }, []);

  if (loading) return <div>読み込み中...</div>;

  const cardStyle = {
    background: "#e8f6f6",
    borderRadius: "20px",
    padding: "20px",
    marginBottom: "20px",
    border: "2px solid #aeece4",
  };

  const titleStyle = {
    color: "#00a68c",
    marginBottom: "12px",
    fontSize: "20px",
    fontWeight: "bold",
  };

  // ★ 今日の入力率（クラウド版）
  const totalStaff = data.staff.length;
  const todayCount = data.records.length;
  const todayRate =
    totalStaff === 0 ? 0 : Math.round((todayCount / totalStaff) * 100);

  return (
    <AdminLayout>
      <button
        onClick={() => window.history.back()}
        style={{
          background: "#00a68c",
          color: "white",
          padding: "10px 20px",
          borderRadius: "10px",
          border: "none",
          marginBottom: "20px",
        }}
      >
        ← 戻る
      </button>

      <h1
        style={{
          color: "#00a68c",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        📈 今日・今月の入力率（クラウド版）
      </h1>

      {/* 今日の入力率 */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>今日の入力率</h2>
        <p>
          今日：{todayCount} / {totalStaff}（{todayRate}%）
        </p>
        <p>未入力者：{data.notEntered.length} 人</p>
        <p>総使用量：{data.totalMl} mL</p>
      </div>

      {/* 今月の入力率（必要なら後で追加） */}
    </AdminLayout>
  );
}
