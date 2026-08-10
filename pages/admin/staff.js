"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function WardStaffPage() {
  const router = useRouter();
  const { wardId } = router.query;   // ★ department → wardId に変更

  if (!wardId) return <p>読み込み中…</p>;

  const [staffList, setStaffList] = useState([]);
  const [wardName, setWardName] = useState("");

  useEffect(() => {
    const savedStaff = JSON.parse(localStorage.getItem("staffList") || "[]");
    const savedWards = JSON.parse(localStorage.getItem("wards") || "[]");

    // ★ wardId に一致する病棟名を取得
    const ward = savedWards.find((w) => w.id === Number(wardId));
    setWardName(ward ? ward.name : "不明な病棟");

    // ★ wardId でスタッフを絞り込む
    const filtered = savedStaff.filter((s) => s.wardId === Number(wardId));
    setStaffList(filtered);
  }, [wardId]);

  // ★ 退職（削除）
  const deleteStaff = (staffId) => {
    const saved = JSON.parse(localStorage.getItem("staffList") || "[]");
    const updated = saved.filter((s) => s.staffId !== staffId);

    localStorage.setItem("staffList", JSON.stringify(updated));
    setStaffList(updated);
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
        👥 {wardName} スタッフ一覧
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {staffList.map((staff) => (
          <div
            key={staff.staffId}
            style={{
              background: "#ffffff",
              border: "1px solid #cfeeee",
              borderRadius: "16px",
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#006b5f",
            }}
          >
            <span>{staff.name}</span>

            <button
              onClick={() => deleteStaff(staff.staffId)}
              style={{
                background: "#ffdddd",
                color: "#a30000",
                border: "none",
                padding: "8px 12px",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              退職（削除）
            </button>
          </div>
        ))}
      </div>

      <div
        onClick={() => router.push(`/admin/ward/${wardId}`)}
        style={{
          marginTop: "24px",
          background: "#ffffff",
          border: "1px solid #cfeeee",
          borderRadius: "16px",
          padding: "20px",
          textAlign: "center",
          cursor: "pointer",
          color: "#006b5f",
        }}
      >
        ← 部署管理メニューに戻る
      </div>
    </main>
  );
}



