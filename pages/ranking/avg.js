"use client";

import { useEffect, useState } from "react";
import RankingHeader from "../../components/RankingHeader";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function AvgRanking() {
  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);

  // ★ タブのデザイン（あなたのミント系そのまま）
  const tabStyle = (active) => ({
    flex: 1,
    padding: "10px 0",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    background: active ? "#006b5f" : "#cfeeee",
    color: active ? "#ffffff" : "#006b5f",
    fontSize: "14px",
  });

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
    return "🫧";
  };

  useEffect(() => {
    const load = async () => {
      const staff = JSON.parse(localStorage.getItem("currentStaff"));
      if (!staff) return;

      // ★ 部署スタッフ一覧（勤務日数を取得）
      const staffSnap = await getDocs(
        query(collection(db, "staff"), where("wardId", "==", staff.wardId))
      );
      const staffList = staffSnap.docs.map(doc => doc.data());

      // ★ 使用量記録
      const recSnap = await getDocs(
        query(collection(db, "records"), where("wardId", "==", staff.wardId))
      );
      const records = recSnap.docs.map(doc => doc.data());

      const now = new Date();

      // ★ 日付フィルタ（Timestamp と文字列両対応）
      const filtered = records.filter(item => {
        let jst;

        if (item.date?.toDate) {
          jst = item.date.toDate();
        } else if (typeof item.date === "string") {
          jst = new Date(item.date);
        } else {
          return false;
        }

        if (period === "today") {
          return (
            jst.getFullYear() === now.getFullYear() &&
            jst.getMonth() === now.getMonth() &&
            jst.getDate() === now.getDate()
          );
        }

        if (period === "month") {
          return (
            jst.getFullYear() === now.getFullYear() &&
            jst.getMonth() === now.getMonth()
          );
        }

        if (period === "year") {
          return jst.getFullYear() === now.getFullYear();
        }

        return true;
      });

      // ★ 合計使用量を集計
      const totals = {};

      filtered.forEach(item => {
        const id = item.staffId;
        const name = item.name;
        const dept = item.department;

        if (!totals[id]) {
          totals[id] = {
            staffId: id,
            name,
            department: dept,
            totalMl: 0,
            workDays: 0,
          };
        }

        totals[id].totalMl += Number(item.ml || 0);
      });

      // ★ staff.workDays を紐づける（勤務日数）
      staffList.forEach(s => {
        if (totals[s.staffId]) {
          totals[s.staffId].workDays = Number(s.workDays || 0);
        }
      });

      // ★ 平均使用量を計算
      const rankingData = Object.values(totals)
        .map(s => ({
          staffId: s.staffId,
          name: s.name,
          department: s.department,
          workDays: s.workDays,
          avgMl: s.workDays > 0 ? s.totalMl / s.workDays : 0,
        }))
        .sort((a, b) => b.avgMl - a.avgMl);

      setRanking(rankingData);
    };

    load();
  }, [period]);

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
      <RankingHeader title="平均使用量ランキング（mL/日）" icon="🫧" />

      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(period === "today")} onClick={() => setPeriod("today")}>今日</button>
        <button style={tabStyle(period === "month")} onClick={() => setPeriod("month")}>今月</button>
        <button style={tabStyle(period === "year")} onClick={() => setPeriod("year")}>今年</button>
        <button style={tabStyle(period === "all")} onClick={() => setPeriod("all")}>累計</button>
      </div>

      {/* ランキングカード */}
      {ranking.map((s, i) => (
        <div key={s.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(i)}</div>

          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
              {i + 1} 位：{s.name}（{s.department}）
            </p>
            <p style={{ margin: 0 }}>勤務日数：{s.workDays} 日</p>
            <p style={{ margin: 0, color: "#008b75", fontWeight: "bold" }}>
              平均使用量：{s.avgMl.toFixed(1)} mL/日
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
