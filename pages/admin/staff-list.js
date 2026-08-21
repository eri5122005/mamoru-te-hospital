"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

export default function StaffListPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const wardId = "ward01"; // ★ あなたの病棟IDに変更

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/ward?id=${wardId}`);
        const data = await res.json();

        setStaff(data.staff);
        setLoading(false);
      } catch (error) {
        alert("スタッフ一覧の取得に失敗しました");
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
        スタッフ一覧（クラウド版）
      </h1>

      <div style={cardStyle}>
        <h2 style={titleStyle}>スタッフ一覧</h2>

        <ul style={{ listStyle: "none", padding: 0 }}>
          {staff.map((s) => (
            <li key={s.staffId} style={{ marginBottom: "10px" }}>
              {s.name}（ID: {s.staffId} ／ 病棟: {s.wardId}）
            </li>
          ))}
        </ul>
      </div>
    </AdminLayout>
  );
}
