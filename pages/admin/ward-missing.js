"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

export default function WardMissing() {
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);

  const wardId = "ward01"; // ★ あなたの病棟IDに変更

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/ward?id=${wardId}`);
        const data = await res.json();

        // ★ API の notEntered をそのまま使う
        setMissing(data.notEntered);
        setLoading(false);
      } catch (error) {
        alert("未入力者データの取得に失敗しました");
      }
    };

    load();
  }, []);

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
        未入力者一覧（クラウド版）
      </h1>

      <div style={cardStyle}>
        <h2 style={titleStyle}>
          <span style={iconStyle}>🔍</span> 今日の未入力者
        </h2>

        {missing.length === 0 ? (
          <p>未入力者はいません 🎉</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {missing.map((s) => (
              <li key={s.staffId} style={{ marginBottom: "10px" }}>
                {s.name}（{s.wardId}）
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}

