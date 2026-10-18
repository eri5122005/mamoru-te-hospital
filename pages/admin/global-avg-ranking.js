"use client";

import { isActiveStaff } from "@/utils/isActiveStaff";

import { getWorkDays } from "@/utils/getWorkDays";
import { isRankingUsageVisible } from "@/utils/isRankingUsageVisible";

import { useEffect, useState } from "react";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import BackButton from "@/components/BackButton";

export default function GlobalAvgRanking() {
  const [ranking, setRanking] = useState([]);
  const [monthLabel, setMonthLabel] = useState("");

  useEffect(() => {
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "numeric",
    }).formatToParts(new Date());
    const part = (type) => parts.find((item) => item.type === type).value;
    setMonthLabel(`📅 ${part("year")}年${part("month")}月`);
  }, []);

  useEffect(() => {
    const load = async () => {
      // ★ 全スタッフ取得（勤務日数を使う）
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs.map(doc => doc.data()).filter(isActiveStaff);
      const activeIds = new Set(staffList.map(s => String(s.staffId)));

      // ★ 全記録取得（部署フィルタなし）
      const recSnap = await getDocs(collection(db, "records"));
      const records = recSnap.docs.map(doc => doc.data());

      const now = new Date();

      const japanMonth = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "numeric",
      });
      const getJstMonth = (date) => {
        const parts = japanMonth.formatToParts(date);
        const part = (type) => parts.find((item) => item.type === type).value;
        return `${part("year")}-${part("month")}`;
      };
      const currentMonth = getJstMonth(now);

      // ★ 日本時間で今月の記録だけを集計
      const filtered = records.filter(item => {
        if (typeof item.date?.toDate !== "function") return false;
        const date = item.date.toDate();
        return Number.isFinite(date.getTime()) && getJstMonth(date) === currentMonth;
      });

      // ★ 個人ごとに集計
      const totals = {};

      filtered.forEach(item => {
        if (!activeIds.has(String(item.staffId))) return;
        const id = item.staffId;
        const name = item.name;
        const department = item.department;

        if (!totals[id]) {
          totals[id] = {
            staffId: id,
            name,
            department,
            totalMl: 0,
            workDays: null,
            avgMl: 0,
          };
        }

        totals[id].totalMl += Number(item.ml || 0);
      });

      // ★ staff コレクションから勤務日数を反映
      staffList.forEach(s => {
        if (totals[s.staffId]) {
          const workDays = getWorkDays(s.workDays);
          totals[s.staffId].workDays = workDays;
          totals[s.staffId].avgMl =
            workDays !== null
              ? totals[s.staffId].totalMl / workDays
              : 0;
        }
      });

      // ★ 勤務日数考慮ランキング
      const sorted = Object.values(totals)
      .filter((item) => isRankingUsageVisible(item.avgMl))
      .sort(
        (a, b) => b.avgMl - a.avgMl
      );

      setRanking(sorted);
    };

    load();
  }, []);

  const cardStyle = {
  background: "#e8f6f6",
  padding: "16px",
  borderRadius: "16px",
  marginBottom: "12px",
  border: "1px solid #cfeeee",   // ← ★ 修正済み
  color: "#006b5f",
  display: "flex",
  alignItems: "center",
  gap: "14px",
};


  const iconBoxStyle = {
    background: "#cfeeee",
    color: "#006b5f",
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: "bold",
  };

  const getRankIcon = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🫧";
  };

  return (
    <main
      style={{
        padding: "20px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <BackButton to="/admin" />

      <h1
  style={{
    textAlign: "center",
    fontSize: "26px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "#006b5f",
  }}
>
  📊 院内 勤務日数を考慮した<br />
  使用量ランキング
</h1>



      <div style={{ textAlign: "center", margin: "0 0 12px" }}>
        <span style={{ display: "inline-block", background: "#e8f6f6", border: "1px solid #cfeeee", color: "#006b5f", borderRadius: "20px", padding: "6px 14px", fontSize: "15px", fontWeight: "bold" }}>
          {monthLabel}
        </span>
      </div>
      <p style={{ fontSize: "13px", lineHeight: 1.7, margin: "0 0 20px" }}>
        今月の使用量を、登録されている月の勤務日数で割った参考値です。
        実際の1勤務あたり使用量を示すものではありません。
      </p>

      {/* ランキングカード */}
      {ranking.length === 0 && (
        <p style={{ color: "#006b5f" }}>今月に使用量のある職員はいません</p>
      )}

      {ranking.map((s, i) => (
        <div key={s.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(i)}</div>

          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
              {i + 1} 位：{s.name}（{s.department}）
            </p>
            <p style={{ margin: 0 }}>勤務日数：{s.workDays} 日</p>
            <p style={{ margin: 0, color: "#008b75", fontWeight: "bold" }}>
              勤務日数考慮：{s.avgMl.toFixed(1)} mL
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
