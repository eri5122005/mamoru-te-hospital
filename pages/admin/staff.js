"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function WardStaffPage() {
  const router = useRouter();
  const { department } = router.query;

  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("staffList") || "[]");

    // この部署のスタッフだけ表示
    const filtered = saved.filter((s) => s.department === department);

    setStaffList(filtered);
  }, [department]);

  // ★ 退職（削除）処理
  const deleteStaff = (staffId) => {
    const saved = JSON.parse(localStorage.getItem("staffList") || "[]");

    // staffList から該当スタッフだけ除外（history は消さない）
    const updated = saved.filter((s) => s.staffId !== staffId);

    // 保存
    localStorage.setItem("staffList", JSON.stringify(updated));

    // 画面更新
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
        👥 {department} スタッフ一覧
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
            <span>
              {staff.name}（{staff.department}）
            </span>

            {/* ★ 退職ボタン（部署管理者が使える） */}
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
        onClick={() => router.push(`/admin/ward/${department}`)}
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


