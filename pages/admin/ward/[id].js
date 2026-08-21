"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";

export default function WardDetailPage() {
  const router = useRouter();
  const { id } = router.query; // wardId

  // ★ data の初期値を null → { records: [] } に変更
  const [data, setData] = useState({ records: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/admin/ward?id=${id}`);
        const json = await res.json();
        setData(json);
        setLoading(false);
      } catch (error) {
        alert("病棟データの取得に失敗しました");
      }
    };

    load();
  }, [id]);

  if (loading) return <div>読み込み中...</div>;

  const cardStyle = {
    background: "#e8f6f6",
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
    border: "2px solid #aeece4",
  };

  const titleStyle = {
    color: "#00a68c",
    marginBottom: "12px",
    fontSize: "20px",
    fontWeight: "bold",
  };

  return (
    <AdminLayout>
      <button
        onClick={() => router.back()}
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
        病棟詳細（{id}）
      </h1>

      {/* 病棟の合計使用量 */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>💧 今日の合計使用量</h2>
        <p>{data.totalMl} mL</p>
      </div>

    {/* 今日の記録一覧 */}
<div style={cardStyle}>
  <h2 style={titleStyle}>📋 今日の記録一覧</h2>

  {!data?.records || data.records.length === 0 ? (
    <p>記録はありません</p>
  ) : (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {data.records.map((r) => (
        <li key={r.recordId} style={{ marginBottom: "10px" }}>
          {r.staffId}：{r.ml} mL
        </li>
      ))}
    </ul>
  )}
</div>

 

      {/* 未入力者 */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>🔍 未入力者</h2>
        {data.notEntered.length === 0 ? (
          <p>未入力者はいません 🎉</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {data.notEntered.map((s) => (
              <li key={s.staffId} style={{ marginBottom: "10px" }}>
                {s.name}（{s.staffId}）
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* スタッフ一覧 */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>👥 スタッフ一覧</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {data.staff.map((s) => (
            <li key={s.staffId} style={{ marginBottom: "10px" }}>
              {s.name}（ID: {s.staffId}）
            </li>
          ))}
        </ul>
      </div>
    </AdminLayout>
  );
}
