"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";

export default function AdminRankingPersonal() {
  const router = useRouter();
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const savedStaff = JSON.parse(localStorage.getItem("staffList") || "[]");
    const savedRecords = JSON.parse(localStorage.getItem("records") || "[]");

    setStaffList(savedStaff);
    setRecords(savedRecords);
  }, []);

  const cardStyle = {
    background: "#e8f6f6",
    borderRadius: "20px",
    padding: "20px",
    marginBottom: "16px",
    border: "2px solid #aeece4",
    cursor: "pointer",
  };

  const titleStyle = {
    color: "#00a68c",
    marginBottom: "20px",
    textAlign: "center",
    fontSize: "22px",
    fontWeight: "bold",
  };

  return (
    <AdminLayout>
      <h1 style={titleStyle}>個人ランキング（全体）</h1>

      {staffList.length === 0 ? (
        <p style={{ textAlign: "center" }}>スタッフが登録されていません</p>
      ) : (
        staffList.map((s) => {
          const staffRecords = records.filter((r) => r.staffId === s.staffId);
          const totalMl = staffRecords.reduce(
            (sum, r) => sum + Number(r.ml || 0),
            0
          );
          const count = staffRecords.length;

          return (
            <div
              key={s.staffId}
              style={cardStyle}
              onClick={() => router.push(`/admin/ranking/${s.staffId}`)}
            >
              <div style={{ fontSize: "28px", color: "#00a68c" }}>👤</div>
              <p style={{ fontSize: "18px", fontWeight: "bold" }}>
                {s.name}（{s.department}）
              </p>
              <p>総使用量：{totalMl} mL</p>
              <p>記録回数：{count} 回</p>
            </div>
          );
        })
      )}
    </AdminLayout>
  );
}
