"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function StaffList() {
  const router = useRouter();
  const { department } = router.query;

  const [staffInDepartment, setStaffInDepartment] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);

  useEffect(() => {
  if (!department) return;
  if (typeof window === "undefined") return;  // ← 追加

  const allStaff = JSON.parse(localStorage.getItem("staffList") || "[]");
  const filtered = allStaff.filter((s) => s.department === department);
  setStaffInDepartment(filtered);
}, [department]);


  // 削除処理
  const deleteStaff = () => {
  if (!selectedStaffId) return;
  if (typeof window === "undefined") return;  // ← 追加

  const allStaff = JSON.parse(localStorage.getItem("staffList") || "[]");
  const updated = allStaff.filter((s) => s.staffId !== selectedStaffId);

  localStorage.setItem("staffList", JSON.stringify(updated));

  setStaffInDepartment(updated.filter((s) => s.department === department));
  setSelectedStaffId(null);
};


  const wardNameMap = {
    "6F": "6階病棟",
    "5F": "5階病棟",
    "OUT": "外来",
    "ICU": "ICU"
  };

  const wardName = wardNameMap[department] || department;

  // ★ 履歴データを取得
  // ★ 履歴データを取得
  const history = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("history") || "[]")
    : [];


  // ★ 部署の履歴だけ抽出
  const deptHistory = history.filter(item => item.department === department);

  // ★ スタッフごとの合計使用量を計算
  const staffTotals = staffInDepartment.map(staff => {
    const totalMl = deptHistory
      .filter(item => item.staffId === staff.staffId)
      .reduce((sum, item) => sum + Number(item.ml), 0);

    return {
      name: staff.name,
      staffId: staff.staffId,
      workDays: staff.workDays,
      totalMl,
      avgMl: staff.workDays > 0 ? totalMl / staff.workDays : 0
    };
  });

  // ★ ランキング
  const avgRanking = [...staffTotals].sort((a, b) => b.avgMl - a.avgMl);
  const totalRanking = [...staffTotals].sort((a, b) => b.totalMl - a.totalMl);
  const workDaysRanking = [...staffTotals].sort((a, b) => b.workDays - a.workDays);

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif"
      }}
    >
      <h1
        style={{
          color: "#006b5f",
          marginBottom: "28px",
          fontSize: "26px",
          fontWeight: "bold",
          textAlign: "center"
        }}
      >
        👥 {wardName} のスタッフ一覧
      </h1>

      {/* スタッフ一覧 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {staffInDepartment.length === 0 && (
          <p style={{ color: "#006b5f", textAlign: "center" }}>
            この部署にはまだスタッフが登録されていません
          </p>
        )}

        {staffInDepartment.map((staff) => (
          <div
            key={staff.staffId}
            onClick={() => setSelectedStaffId(staff.staffId)}
            style={{
              background:
                selectedStaffId === staff.staffId ? "#e8f6f6" : "#ffffff",
              border: "1px solid #cfeeee",
              borderRadius: "14px",
              padding: "16px",
              fontSize: "18px",
              color: "#006b5f",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              cursor: "pointer"
            }}
          >
            {staff.name}（ID: {staff.staffId}）

            <p style={{ marginTop: "6px", color: "#008b75" }}>
              勤務日数：{staff.workDays} 日
            </p>
          </div>
        ))}
      </div>

      {/* ★ ランキング表示（正しい位置） */}
      <h2 style={{ marginTop: "40px", color: "#006b5f" }}>平均使用量ランキング</h2>
      {avgRanking.map((s, i) => (
        <p key={s.staffId}>
          {i + 1}位：{s.name}（{s.avgMl.toFixed(1)} mL/日）
        </p>
      ))}

      <h2 style={{ marginTop: "40px", color: "#006b5f" }}>総使用量ランキング</h2>
      {totalRanking.map((s, i) => (
        <p key={s.staffId}>
          {i + 1}位：{s.name}（{s.totalMl.toFixed(1)} mL）
        </p>
      ))}

      <h2 style={{ marginTop: "40px", color: "#006b5f" }}>勤務日数ランキング</h2>
      {workDaysRanking.map((s, i) => (
        <p key={s.staffId}>
          {i + 1}位：{s.name}（{s.workDays} 日）
        </p>
      ))}

      {/* 戻るボタン */}
      <div
        onClick={() => router.push(`/admin/ward/${department}`)}
        style={{
          background: "#e8f6f6",
          color: "#006b5f",
          padding: "14px",
          borderRadius: "12px",
          textAlign: "center",
          cursor: "pointer",
          fontSize: "18px",
          marginTop: "32px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}
      >
        ← 部署管理ページに戻る
      </div>
    </main>
  );
}

