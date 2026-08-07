"use client";

import { useRouter } from "next/router";

export default function UnrecordedList() {
  const router = useRouter();
  const { department } = router.query;

  if (!department) return <p>読み込み中…</p>;

  // スタッフ一覧
  const allStaff = JSON.parse(localStorage.getItem("staffList") || "[]");
  const staffInDepartment = allStaff.filter(s => s.department === department);

  // 記録一覧
  const records = JSON.parse(localStorage.getItem("records") || "[]");

  // 今日の日付
  const today = new Date().toISOString().split("T")[0];

  // 今日記録したスタッフID
  const recordedToday = records
    .filter(r => r.date === today)
    .map(r => r.staffId);

  // 未入力者
  const unrecordedStaff = staffInDepartment.filter(
    s => !recordedToday.includes(s.staffId)
  );

  const wardNameMap = {
    "6F": "6階病棟",
    "5F": "5階病棟",
    "OUT": "外来",
    "ICU": "ICU"
  };

  const wardName = wardNameMap[department] || department;

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "28px", fontSize: "26px", textAlign: "center" }}>
        ⚠️ {wardName} 未入力者リスト
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {unrecordedStaff.length === 0 && (
          <p style={{ color: "#006b5f", textAlign: "center" }}>
            今日の未入力者はいません
          </p>
        )}

        {unrecordedStaff.map((staff) => (
          <div
            key={staff.staffId}
            style={{
              background: "#ffffff",
              border: "1px solid #cfeeee",
              borderRadius: "14px",
              padding: "16px",
              fontSize: "18px",
              color: "#006b5f",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
            }}
          >
            {staff.name}（ID: {staff.staffId}）
          </div>
        ))}
      </div>

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
          marginTop: "32px"
        }}
      >
        ← 部署管理ページに戻る
      </div>
    </main>
  );
}
