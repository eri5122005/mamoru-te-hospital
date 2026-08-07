"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function StatsPage() {
  const router = useRouter();
  const { department } = router.query;

  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!department) return;

    const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");
    const records = JSON.parse(localStorage.getItem("records") || "[]");

    const staffInDept = staffList.filter(s => s.department === department);

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 期間判定関数
    const isToday = (d) =>
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const isThisWeek = (d) => {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return d >= start && d <= end;
    };

    const isThisMonth = (d) =>
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth();

    const isThisYear = (d) =>
      d.getFullYear() === now.getFullYear();

    const deptRecords = records.filter(r => r.department === department);

    const todayTotal = deptRecords
      .filter(r => isToday(new Date(r.date)))
      .reduce((sum, r) => sum + Number(r.ml), 0);

    const weekTotal = deptRecords
      .filter(r => isThisWeek(new Date(r.date)))
      .reduce((sum, r) => sum + Number(r.ml), 0);

    const monthTotal = deptRecords
      .filter(r => isThisMonth(new Date(r.date)))
      .reduce((sum, r) => sum + Number(r.ml), 0);

    const yearTotal = deptRecords
      .filter(r => isThisYear(new Date(r.date)))
      .reduce((sum, r) => sum + Number(r.ml), 0);

    const allTotal = deptRecords
      .reduce((sum, r) => sum + Number(r.ml), 0);

    const staffStats = staffInDept.map(s => {
      const personal = deptRecords.filter(r => r.staffId === s.staffId);
      const total = personal.reduce((sum, r) => sum + Number(r.ml), 0);
      return { name: s.name, staffId: s.staffId, total };
    });

    setStats({
      todayTotal,
      weekTotal,
      monthTotal,
      yearTotal,
      allTotal,
      staffStats
    });
  }, [department]);

  if (!stats) return <p style={{ textAlign: "center", color: "#006b5f" }}>読み込み中…</p>;

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
          textAlign: "center",
          marginBottom: "24px",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px"
        }}
      >
        🧴📊 {department} 統計ページ
      </h1>

      {/* 期間別カード */}
      <div style={card}>
        <div style={cardTitle}>🌞 今日の合計</div>
        <div style={cardValue}>{stats.todayTotal} mL</div>
      </div>

      <div style={card}>
        <div style={cardTitle}>📅 今週の合計</div>
        <div style={cardValue}>{stats.weekTotal} mL</div>
      </div>

      <div style={card}>
        <div style={cardTitle}>🗓 今月の合計</div>
        <div style={cardValue}>{stats.monthTotal} mL</div>
      </div>

      <div style={card}>
        <div style={cardTitle}>📆 今年の合計</div>
        <div style={cardValue}>{stats.yearTotal} mL</div>
      </div>

      <div style={card}>
        <div style={cardTitle}>📚 全期間の合計</div>
        <div style={cardValue}>{stats.allTotal} mL</div>
      </div>

      <h2 style={{ color: "#006b5f", marginTop: "24px", marginBottom: "12px" }}>
        👥 スタッフ別使用量
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {stats.staffStats.map(s => (
          <div key={s.staffId} style={staffCard}>
            <span style={{ fontWeight: "600" }}>{s.name}</span>
            <span style={{ opacity: 0.7 }}>（{s.staffId}）</span>
            <span style={{ marginLeft: "auto", fontWeight: "600" }}>
              {s.total} mL
            </span>
          </div>
        ))}
      </div>

      <button
        style={mintButton}
        onClick={() => router.push(`/admin/ward/${department}/graph`)}
      >
        📈 グラフを見る
      </button>

      <button
  style={backButton}
  onClick={() => router.push(`/admin/ward/${department}`)}
>
  ← 管理ページに戻る
</button>

    </main>
  );
}

const card = {
  background: "#ffffff",
  borderRadius: "12px",
  padding: "18px",
  border: "2px solid #cfeeee",
  marginBottom: "16px",
  textAlign: "center"
};

const cardTitle = {
  color: "#006b5f",
  fontSize: "18px",
  marginBottom: "6px"
};

const cardValue = {
  color: "#006b5f",
  fontSize: "24px",
  fontWeight: "600"
};

const staffCard = {
  background: "#ffffff",
  border: "1px solid #cfeeee",
  borderRadius: "12px",
  padding: "14px",
  fontSize: "18px",
  color: "#006b5f",
  display: "flex",
  gap: "8px"
};

const mintButton = {
  background: "#4BB5C1",
  color: "white",
  padding: "12px 20px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  marginTop: "24px",
  width: "100%"
};

const backButton = {
  background: "#e8f6f6",
  color: "#006b5f",
  padding: "12px 20px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  marginTop: "12px",
  width: "100%"
};


