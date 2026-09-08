"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";                 
import BackButton from "../../../../components/BackButton";
import { db } from "../../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function AvgRanking() {
  const router = useRouter();
  const { wardId } = router.query;   // ★ URL から取得（正しい）

  const [period, setPeriod] = useState("today");
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const load = async () => {
      const staff = JSON.parse(localStorage.getItem("currentStaff"));
      if (!staff) return;

      // ★ 自部署の記録
      const q = query(
        collection(db, "records"),
        where("wardId", "==", staff.wardId)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(doc => doc.data());

      // ★ 全スタッフ情報（勤務日数・名前補完）
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs.map(doc => doc.data());
      const staffMap = {};
      staffList.forEach(s => {
        if (s.staffId) {
          staffMap[s.staffId] = s;
        }
      });

      const now = new Date();

      const filtered = records.filter(item => {
        const t = item.date.toDate();
        const jst =
          t.getTimezoneOffset() === 0
            ? new Date(t.getTime() + 9 * 60 * 60 * 1000)
            : t;

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

      const map = {};

      filtered.forEach(item => {
        const staffId = item.staffId;
        if (!staffId) return;

        const sInfo = staffMap[staffId] || {};

        if (!map[staffId]) {
          map[staffId] = {
            staffId,
            name: item.name || sInfo.name || "名前未登録",
            department: item.department || sInfo.department || "",
            totalMl: 0,
          };
        }

        map[staffId].totalMl += Number(item.ml || 0);
      });

      // ★ 平均計算（勤務日数は staff.workDays を使う）
      const rankingData = Object.values(map)
        .map(s => {
          const staffInfo = staffMap[s.staffId] || {};
          const workDays = staffInfo.workDays || 0;

          return {
            staffId: s.staffId,
            name: s.name,
            department: s.department,
            workDays,
            avgMl: workDays > 0 ? s.totalMl / workDays : 0,
          };
        })
        .sort((a, b) => b.avgMl - a.avgMl);

      setRanking(rankingData);
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
      {/* ★ 戻るボタン（localStorage を使わない正しい形） */}
      <BackButton to={`/admin/ward/${wardId}`} />

      {/* ★ タイトル（3行＋アイコン） */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "22px", fontWeight: "600", color: "#006b5f" }}>
          📈 勤務日数を考慮した
        </div>
        <div style={{ fontSize: "22px", fontWeight: "600", color: "#006b5f" }}>
          平均使用量ランキング
        </div>
        <div style={{ fontSize: "18px", fontWeight: "500", color: "#008b75" }}>
          （mL/日）
        </div>
      </div>

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
              {i + 1} 位：{s.name}
              {s.department && `（${s.department}）`}
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
