"use client";

import { useEffect, useState } from "react";

export default function DepartmentPage() {

  // ★ staffList と records を使う（history は使わない）
  const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");
  const records = JSON.parse(localStorage.getItem("records") || "[]");

  // ★ 今日の日付
  const today = new Date().toISOString().split("T")[0];

  // ★ 今日記録したスタッフID
  const todayRecordIds = records
    .filter(r => r.date === today)
    .map(r => r.staffId);

  // ★ ログイン中の部署を取得
  const loginUser = JSON.parse(localStorage.getItem("loginUser") || "{}");
  const dept = loginUser.department;

  // ★ 部署のスタッフ
  const deptStaff = staffList.filter(s => s.department === dept);

  // ★ 未入力者（総合管理者と完全一致する）
  const missing = deptStaff.filter(s => !todayRecordIds.includes(s.staffId));

  // ★ history（部署別集計用）
  const [history, setHistory] = useState([]);

  const departments = [
    "4階病棟",
    "5階病棟",
    "6階病棟",
    "7・8階病棟",
    "外来",
    "リハビリ"
  ];

  useEffect(() => {
    const h = JSON.parse(localStorage.getItem("history") || "[]");
    setHistory(h);
  }, []);

  const getDeptStats = (dept) => {
    const deptData = history.filter((h) => h.department === dept);

    if (deptData.length === 0) {
      return {
        totalMl: 0,
        avgMl: 0,
        count: 0,
        mintPoint: 0,
        maxCombo: 0
      };
    }

    const totalMl = deptData.reduce((sum, h) => sum + Number(h.ml), 0);
    const avgMl = (totalMl / deptData.length).toFixed(1);
    const mintPoint = deptData.reduce((sum, h) => sum + Number(h.mintPoint || 0), 0);
    const maxCombo = Math.max(...deptData.map((h) => Number(h.combo || 0)));

    return {
      totalMl,
      avgMl,
      count: deptData.length,
      mintPoint,
      maxCombo
    };
  };

  return (
    <main style={{ padding: "20px" }}>
      <h1>部署別集計</h1>

      {/* ★ 未入力者リスト（正しい位置） */}
      <div
        style={{
          background: "#e8f6f6",
          padding: "20px",
          borderRadius: "16px",
          marginBottom: "20px"
        }}
      >
        <h2 style={{ color: "#006b5f" }}>{dept} の未入力者</h2>

        {missing.length === 0 ? (
          <p>未入力者はいません 🎉</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {missing.map((s) => (
              <li key={s.staffId} style={{ marginBottom: "10px" }}>
                {s.name}（ID: {s.staffId}）
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ★ 部署別集計 */}
      {departments.map((dept) => {
        const stats = getDeptStats(dept);

        return (
          <div
            key={dept}
            style={{
              background: "#f0faff",
              padding: "15px",
              marginBottom: "15px",
              borderRadius: "12px",
              border: "1px solid #cfeeee"
            }}
          >
            <h2 style={{ marginBottom: "10px" }}>{dept}</h2>

            <div>総使用量：{stats.totalMl} mL</div>
            <div>平均使用量：{stats.avgMl} mL</div>
            <div>記録回数：{stats.count} 回</div>
            <div>ミントポイント合計：{stats.mintPoint} pt</div>
            <div>最大コンボ：{stats.maxCombo}</div>
          </div>
        );
      })}
    </main>
  );
}
