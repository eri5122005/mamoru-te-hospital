"use client";

import { useEffect, useState } from "react";

export default function AllWardsStats() {
  const [wards, setWards] = useState([]);

  useEffect(() => {
    const wardData = JSON.parse(localStorage.getItem("wards") || "[]");
    const history = JSON.parse(localStorage.getItem("history") || "[]");

    const now = new Date();

    const isToday = (date) =>
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    const isThisWeek = (date) => {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return date >= start && date <= end;
    };

    const isThisMonth = (date) =>
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth();

    const wardStats = wardData.map((ward) => {
      const staffList = JSON.parse(localStorage.getItem(`staff_${ward.id}`) || "[]");

      const wardHistory = history.filter((h) => h.department === ward.name);

      let today = 0, week = 0, month = 0;

      wardHistory.forEach((item) => {
        const d = new Date(item.time);
        const ml = Number(item.ml);

        if (isToday(d)) today += ml;
        if (isThisWeek(d)) week += ml;
        if (isThisMonth(d)) month += ml;
      });

      const todayStaff = new Set(
        wardHistory
          .filter((h) => isToday(new Date(h.time)))
          .map((h) => h.staffId)
      ).size;

      const rate = staffList.length > 0
        ? Math.round((todayStaff / staffList.length) * 100)
        : 0;

      return {
        name: ward.name,
        today,
        week,
        month,
        rate,
      };
    });

    setWards(wardStats);
  }, []);

  return (
    <main style={{ background: "#F9F9F9", minHeight: "100vh", padding: "24px" }}>
      <button
  onClick={() => window.history.back()}
  style={{
    background: "#006b5f",
    color: "white",
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    marginBottom: "20px"
  }}
>
  戻る
</button>

      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
        全病棟の統計
      </h1>

      {wards.map((ward, index) => (
        <div
          key={index}
          style={{
            background: "white",
            border: "1px solid #cfeeee",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ color: "#006b5f" }}>{ward.name}</h2>

          <p>今日の合計：{ward.today.toFixed(1)} mL</p>
          <p>今週の合計：{ward.week.toFixed(1)} mL</p>
          <p>今月の合計：{ward.month.toFixed(1)} mL</p>

          <p style={{ fontWeight: "bold", marginTop: "10px" }}>
            入力率：{ward.rate}%
          </p>
        </div>
      ))}
    </main>
  );
}
