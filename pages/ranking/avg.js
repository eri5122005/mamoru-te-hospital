"use client";

import { isActiveStaff } from "@/utils/isActiveStaff";

import { getWorkDays } from "@/utils/getWorkDays";
import { isRankingUsageVisible } from "@/utils/isRankingUsageVisible";
import { getRecordDate } from "@/utils/getRecordDate";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function AvgRanking() {
  const router = useRouter();
  const [ranking, setRanking] = useState([]);
  const [monthLabel, setMonthLabel] = useState("");

  // ★ ランキングカードのデザイン（あなたのまま）
  const cardStyle = {
    background: "#e8f6f6",
    padding: "16px",
    borderRadius: "16px",
    marginBottom: "12px",
    border: "1px solid #cfeeee",
    color: "#006b5f",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  };

  // ★ アイコンボックス（あなたのまま）
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

  // ★ ランクアイコン（あなたのまま）
  const getRankIcon = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "⏱️";
  };

  useEffect(() => {
    const load = async () => {
      const staff = JSON.parse(localStorage.getItem("currentStaff"));
      if (!staff) return;

      // ★ 部署スタッフ一覧（勤務日数を取得）
      const staffSnap = await getDocs(
        query(collection(db, "staff"), where("wardId", "==", staff.wardId))
      );
      const staffList = staffSnap.docs.map(doc => doc.data()).filter(isActiveStaff);
      const activeIds = new Set(staffList.map(s => String(s.staffId)));

      // ★ 使用量記録
      const recSnap = await getDocs(
        query(collection(db, "records"), where("wardId", "==", staff.wardId))
      );
      const records = recSnap.docs.map(doc => doc.data());

      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "numeric",
      }).formatToParts(now);
      const part = (type) => Number(parts.find((item) => item.type === type).value);
      const year = part("year");
      const month = part("month");
      setMonthLabel(`📅 ${year}年${month}月`);
      const monthStart = new Date(Date.UTC(year, month - 1, 1, -9));
      const monthEnd = new Date(Date.UTC(year, month, 1, -9));

      // ★ 日本時間の月初以上・翌月月初未満
      const filtered = records.filter(item => {
        const date = getRecordDate(item.date);
        return date !== null && date >= monthStart && date < monthEnd;
      });

      // ★ 合計使用量を集計
      const totals = {};

      filtered.forEach(item => {
        if (!activeIds.has(String(item.staffId))) return;
        const id = item.staffId;
        const name = item.name;
        const dept = item.department;

        if (!totals[id]) {
          totals[id] = {
            staffId: id,
            name,
            department: dept,
            totalMl: 0,
            workDays: null,
          };
        }

        totals[id].totalMl += Number(item.ml || 0);
      });

      // ★ staff.workDays を紐づける（勤務日数）
      staffList.forEach(s => {
        if (totals[s.staffId]) {
          totals[s.staffId].workDays = getWorkDays(s.workDays);
        }
      });

      // ★ 登録月間勤務日数で補正した使用量を計算
      const rankingData = Object.values(totals)
        .map(s => ({
          staffId: s.staffId,
          name: s.name,
          department: s.department,
          workDays: s.workDays,
          avgMl: s.workDays !== null ? s.totalMl / s.workDays : 0,
        }))
        .filter((item) => isRankingUsageVisible(item.avgMl))
        .sort((a, b) => b.avgMl - a.avgMl);

      setRanking(rankingData);
    };

    load();
  }, []);

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
      <button
  onClick={() => router.push("/ranking")}
  style={{
    background: "#cfeeee",
    color: "#006b5f",
    border: "none",
    padding: "10px 16px",
    borderRadius: "12px",
    fontSize: "16px",
    cursor: "pointer",
    marginBottom: "20px",
    width: "100%",
  }}
>
  ← ランキングメニューに戻る
</button>

<h1
  style={{
    color: "#006b5f",
    marginBottom: "10px",
    textAlign: "center",
    fontSize: "26px",
    fontWeight: "600",
  }}
>
  <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
    ⏱️ 勤務日数を考慮した
  </span>
  <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
    使用量ランキング
  </span>
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
