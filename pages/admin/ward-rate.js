"use client";

import { useEffect, useState } from "react";

export default function WardRatePage() {
  const [wards, setWards] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [recordList, setRecordList] = useState([]);
  const [todayStats, setTodayStats] = useState([]);
  const [monthStats, setMonthStats] = useState([]);

  useEffect(() => {
    const savedWards = JSON.parse(localStorage.getItem("wards") || "[]");
    const savedStaff = JSON.parse(localStorage.getItem("staffList") || "[]");
    const savedRecords = JSON.parse(localStorage.getItem("recordList") || "[]");

    setWards(savedWards);
    setStaffList(savedStaff);
    setRecordList(savedRecords);

    calculateRates(savedWards, savedStaff, savedRecords);
  }, []);

  const calculateRates = (wards, staffList, recordList) => {
    const today = new Date().toISOString().split("T")[0];
    const month = today.slice(0, 7); // YYYY-MM

    const todayRecords = recordList.filter((r) => r.date === today);
    const monthRecords = recordList.filter((r) => r.date.startsWith(month));

    // ★ wardId で比較する（ズレゼロ）
    const todayResult = wards.map((ward) => {
      const staffInWard = staffList.filter((s) => s.wardId === ward.id);
      const staffIds = staffInWard.map((s) => s.staffId);

      const inputToday = todayRecords.filter((r) =>
        staffIds.includes(r.staffId)
      );

      return {
        wardName: ward.name,
        totalStaff: staffInWard.length,
        inputCount: inputToday.length,
        rate:
          staffInWard.length === 0
            ? 0
            : Math.round((inputToday.length / staffInWard.length) * 100),
      };
    });

    const monthResult = wards.map((ward) => {
      const staffInWard = staffList.filter((s) => s.wardId === ward.id);
      const staffIds = staffInWard.map((s) => s.staffId);

      const inputMonth = monthRecords.filter((r) =>
        staffIds.includes(r.staffId)
      );

      return {
        wardName: ward.name,
        totalStaff: staffInWard.length,
        inputCount: inputMonth.length,
        rate:
          staffInWard.length === 0
            ? 0
            : Math.round((inputMonth.length / staffInWard.length) * 100),
      };
    });

    setTodayStats(todayResult);
    setMonthStats(monthResult);
  };

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#00a68c", textAlign: "center", marginBottom: "24px" }}>
        📈 今日・今月の入力率
      </h1>

      <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>今日の入力率</h2>
      {todayStats.map((w) => (
        <div
          key={w.wardName}
          style={{
            background: "#ffffff",
            border: "1px solid #cfeeee",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <p>{w.wardName}</p>
          <p>
            {w.inputCount} / {w.totalStaff}（{w.rate}%）
          </p>
        </div>
      ))}

      <h2 style={{ color: "#006b5f", marginTop: "24px", marginBottom: "12px" }}>
        今月の入力率
      </h2>
      {monthStats.map((w) => (
        <div
          key={w.wardName}
          style={{
            background: "#ffffff",
            border: "1px solid #cfeeee",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "12px",
          }}
        >
          <p>{w.wardName}</p>
          <p>
            {w.inputCount} / {w.totalStaff}（{w.rate}%）
          </p>
        </div>
      ))}
    </main>
  );
}
