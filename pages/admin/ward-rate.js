"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

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
    const month = today.slice(0, 7);

    const todayRecords = recordList.filter((r) => r.date === today);
    const monthRecords = recordList.filter((r) => r.date.startsWith(month));

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

  const cardStyle = {
    background: "#e8f6f6",
    borderRadius: "20px",
    padding: "20px",
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
      <button
        onClick={() => window.history.back()}
        style={{
          background: "#00a68c",
          color: "white",
          padding: "10px 20px",
          borderRadius: "10px",
          border: "none",
          marginBottom: "20px",
        }}
      >
        ← 戻る
      </button>

      <h1
        style={{
          color: "#00a68c",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        📈 今日・今月の入力率
      </h1>

      {/* 今日の入力率 */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>今日の入力率</h2>
        {todayStats.map((w) => (
          <p key={w.wardName}>
            {w.wardName}：{w.inputCount} / {w.totalStaff}（{w.rate}%）
          </p>
        ))}
      </div>

      {/* 今月の入力率 */}
      <div style={cardStyle}>
        <h2 style={titleStyle}>今月の入力率</h2>
        {monthStats.map((w) => (
          <p key={w.wardName}>
            {w.wardName}：{w.inputCount} / {w.totalStaff}（{w.rate}%）
          </p>
        ))}
      </div>
    </AdminLayout>
  );
}
