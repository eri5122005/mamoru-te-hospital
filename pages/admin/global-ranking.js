"use client";

import { isActiveStaff } from "@/utils/isActiveStaff";

import { getRecordDate } from "@/utils/getRecordDate";
import { isRankingUsageVisible } from "@/utils/isRankingUsageVisible";

import { useEffect, useState } from "react";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import BackButton from "@/components/BackButton";

export default function GlobalRanking() {
  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const load = async () => {
      // ★ 全スタッフ取得
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs.map(doc => doc.data()).filter(isActiveStaff);
      const activeIds = new Set(staffList.map(s => String(s.staffId)));

      // ★ 全記録取得
      const recSnap = await getDocs(collection(db, "records"));
      const records = recSnap.docs.map(doc => doc.data());

      const now = new Date();

      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
      }).formatToParts(now);
      const part = (type) => Number(parts.find((item) => item.type === type).value);
      const year = part("year");
      const month = part("month");
      const day = part("day");
      let start, end;
      if (period === "today") {
        start = new Date(Date.UTC(year, month - 1, day, -9));
        end = new Date(Date.UTC(year, month - 1, day + 1, -9));
      } else if (period === "month") {
        start = new Date(Date.UTC(year, month - 1, 1, -9));
        end = new Date(Date.UTC(year, month, 1, -9));
      } else if (period === "year") {
        start = new Date(Date.UTC(year, 0, 1, -9));
        end = new Date(Date.UTC(year + 1, 0, 1, -9));
      }

      // ★ JSTの開始以上・終了未満。累計は日付による除外をしない。
      const filtered = records.filter(item => {
        if (period === "all") return true;
        const date = getRecordDate(item.date);
        return date !== null && date >= start && date < end;
      });

      // ★ 個人ごとに集計
      const totals = {};

      filtered.forEach(item => {
        if (!activeIds.has(String(item.staffId))) return;
        const id = item.staffId || "unknown";
        const name = item.name || "不明";

        if (!totals[id]) {
          totals[id] = {
            staffId: id,
            name,
            totalMl: 0,
            count: 0,
          };
        }

        totals[id].totalMl += Number(item.ml || 0);
        totals[id].count += 1;
      });

      // ★ 部署名を staff コレクションから反映
      staffList.forEach(s => {
        if (totals[s.staffId]) {
          totals[s.staffId].department = s.department;
        }
      });

      // ★ 使用量ランキング
      const sorted = Object.values(totals)
      .filter((item) => isRankingUsageVisible(item.totalMl))
      .sort(
        (a, b) => b.totalMl - a.totalMl
      );

      setRanking(sorted);
    };

    load();
  }, [period]);

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

  

const iconBoxStyle = {
  background: "#cfeeee",
  color: "#006b5f",
  width: "48px",
  height: "48px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "26px",
};


  const getRankIcon = (index) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return "🧴";
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
        🧴 院内個人ランキング
      </h1>

      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(period === "today")} onClick={() => setPeriod("today")}>今日</button>
        <button style={tabStyle(period === "month")} onClick={() => setPeriod("month")}>今月</button>
        <button style={tabStyle(period === "year")} onClick={() => setPeriod("year")}>今年</button>
        <button style={tabStyle(period === "all")} onClick={() => setPeriod("all")}>累計</button>
      </div>

      {/* ランキング（華やか版） */}
{ranking.length === 0 && (
        <p style={{ color: "#006b5f" }}>対象期間に使用量のある職員はいません</p>
      )}

      {ranking.map((item, index) => {
  const medal =
    index === 0 ? "🥇" :
    index === 1 ? "🥈" :
    index === 2 ? "🥉" : "✨";

  const bgColor =
    index === 0 ? "#FFF7D1" :   // 金
    index === 1 ? "#F0F4F8" :   // 銀
    index === 2 ? "#F8E6D8" :   // 銅
    "#E8F8F6";                  // その他（ミント）

  return (
    <div key={index} style={{
      background: bgColor,
      borderRadius: "14px",
      padding: "16px",
      border: "1px solid #cfeeee",
      minHeight: "140px",
      display: "flex",
      alignItems: "center",
      animation: "fadeIn 0.4s ease",
      marginBottom: "16px",

    }}>
      <div style={{ marginLeft: "24px", fontSize: "40px", flexShrink: 0 }}>
        {medal}
      </div>

      <div style={{ marginLeft: "20px", minWidth: 0, overflowWrap: "anywhere" }}>
        <div style={{ fontSize: "18px", color: "#006b5f", fontWeight: "bold" }}>
          {index + 1} 位：{item.name}
        </div>
        <div style={{ fontSize: "14px", color: "#006b5f", whiteSpace: "nowrap" }}>
          （{item.department}）
        </div>
        <div style={{ fontSize: "28px", fontWeight: "700", color: "#006b5f" }}>
          <div style={{ fontSize: "28px", fontWeight: "700", color: "#006b5f" }}>
  {item.totalMl.toFixed(1)} mL
</div>


        </div>
      </div>
    </div>
  );
})}
<style jsx>{`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`}</style>

    </main>
  );
}
