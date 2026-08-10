"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";

export default function AdminTop() {
  const [wards, setWards] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [recordList, setRecordList] = useState([]);

  const [todayStats, setTodayStats] = useState({});
  const [monthStats, setMonthStats] = useState({});
  const [wardStats, setWardStats] = useState([]);

  useEffect(() => {
    const savedWards = JSON.parse(localStorage.getItem("wards") || "[]");
    const savedStaff = JSON.parse(localStorage.getItem("staffList") || "[]");
    const savedRecords = JSON.parse(localStorage.getItem("recordList") || "[]");

    setWards(savedWards);
    setStaffList(savedStaff);
    setRecordList(savedRecords);

    calculateAll(savedWards, savedStaff, savedRecords);
  }, []);

  const calculateAll = (wards, staffList, recordList) => {
    const today = new Date().toISOString().split("T")[0];
    const month = today.slice(0, 7);

    const todayRecords = recordList.filter((r) => r.date === today);
    const monthRecords = recordList.filter((r) => r.date.startsWith(month));

    // 今日の集計
    const todayInputCount = todayRecords.length;
    const todayTotalAmount = todayRecords.reduce((sum, r) => sum + r.amount, 0);

    const todayMissing = staffList.filter(
      (s) => !todayRecords.some((r) => r.staffId === s.staffId)
    );

    const todayRate =
      staffList.length === 0
        ? 0
        : Math.round((todayInputCount / staffList.length) * 100);

    setTodayStats({
      rate: todayRate,
      totalAmount: todayTotalAmount,
      count: todayInputCount,
      missing: todayMissing.length,
    });

    // 今月の集計
    const monthInputCount = monthRecords.length;
    const monthTotalAmount = monthRecords.reduce((sum, r) => sum + r.amount, 0);

    const monthMissing = staffList.filter(
      (s) => !monthRecords.some((r) => r.staffId === s.staffId)
    );

    const monthRate =
      staffList.length === 0
        ? 0
        : Math.round((monthInputCount / staffList.length) * 100);

    setMonthStats({
      rate: monthRate,
      totalAmount: monthTotalAmount,
      count: monthInputCount,
      missing: monthMissing.length,
    });

    // 病棟別状況（wardId で比較）
    const wardResult = wards.map((ward) => {
      const staffInWard = staffList.filter((s) => s.wardId === ward.id);
      const staffIds = staffInWard.map((s) => s.staffId);

      const inputToday = todayRecords.filter((r) =>
        staffIds.includes(r.staffId)
      );

      const missingToday = staffInWard.filter(
        (s) => !inputToday.some((r) => r.staffId === s.staffId)
      );

      return {
        wardName: ward.name,
        rate:
          staffInWard.length === 0
            ? 0
            : Math.round((inputToday.length / staffInWard.length) * 100),
        missing: missingToday.length,
      };
    });

    setWardStats(wardResult);
  };

  const cardStyle = {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    marginBottom: "20px",
    border: "1px solid #cfeeee",
  };

  const titleStyle = {
    color: "#006b5f",
    marginBottom: "12px",
    fontSize: "18px",
    fontWeight: "bold",
  };

  const iconStyle = {
    fontSize: "36px",
    marginBottom: "10px",
    color: "#00a68c",
    textAlign: "center",
  };

  return (
    <AdminLayout>
      <h1
        style={{
          marginBottom: "24px",
          color: "#006b5f",
          textAlign: "center",
        }}
      >
        管理者トップ
      </h1>

      {/* 今日の状況 */}
      <div style={cardStyle}>
        <div style={iconStyle}>📅</div>
        <h2 style={titleStyle}>今日の状況</h2>
        <p>入力率：{todayStats.rate}%</p>
        <p>総使用量：{todayStats.totalAmount} mL</p>
        <p>記録件数：{todayStats.count} 回</p>
        <p>未入力者：{todayStats.missing} 人</p>
      </div>

      {/* 今月の状況 */}
      <div style={cardStyle}>
        <div style={iconStyle}>📆</div>
        <h2 style={titleStyle}>今月の状況</h2>
        <p>入力率：{monthStats.rate}%</p>
        <p>総使用量：{monthStats.totalAmount} mL</p>
        <p>記録件数：{monthStats.count} 回</p>
        <p>未入力者：{monthStats.missing} 人</p>
      </div>

      {/* 病棟別状況 */}
      <div style={cardStyle}>
        <div style={iconStyle}>🏥</div>
        <h2 style={titleStyle}>病棟別状況</h2>

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {wardStats.map((w) => (
            <li key={w.wardName} style={{ marginBottom: "10px" }}>
              {w.wardName}：入力率 {w.rate}% ／ 未入力者 {w.missing}人
            </li>
          ))}
        </ul>
      </div>
    </AdminLayout>
  );
}
