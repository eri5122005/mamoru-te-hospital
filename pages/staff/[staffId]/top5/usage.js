"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import BackButton from "@/components/BackButton";
import { db } from "../../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function UsageTop5Page() {
  const router = useRouter();
  const { staffId } = router.query;

  const [ranking, setRanking] = useState([]);
  const [mode, setMode] = useState("week"); // week / month / year
  const [loading, setLoading] = useState(true);

  const modeLabel = {
    week: "今週",
    month: "今月",
    year: "今年",
  };

  useEffect(() => {
    if (!staffId) return;

    const load = async () => {
      setLoading(true);

      // 全スタッフ
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs.map((d) => d.data());

      // 全記録
      const recSnap = await getDocs(collection(db, "records"));
      const records = recSnap.docs.map((d) => d.data());

      const now = new Date();

      // 週の開始（日曜）
      const startOfWeek = new Date();
      startOfWeek.setDate(now.getDate() - now.getDay());

      // 期間フィルタ
      const filtered = records.filter((r) => {
        const t = r.date.toDate();
        const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);

        if (mode === "week") {
          return jst >= startOfWeek && jst <= now;
        }
        if (mode === "month") {
          return (
            jst.getFullYear() === now.getFullYear() &&
            jst.getMonth() === now.getMonth()
          );
        }
        if (mode === "year") {
          return jst.getFullYear() === now.getFullYear();
        }
        return true;
      });

      // スタッフごとに集計
      const result = staffList.map((s) => {
        const myRecords = filtered.filter(
          (r) => String(r.staffId) === String(s.staffId)
        );

        const totalMl = myRecords.reduce(
          (sum, r) => sum + Number(r.ml || 0),
          0
        );

        return {
          staffId: s.staffId,
          name: s.name,
          totalMl,
        };
      });

      // ソートして TOP5
      result.sort((a, b) => b.totalMl - a.totalMl);
      setRanking(result.slice(0, 5));

      setLoading(false);
    };

    load();
  }, [staffId, mode]);

  if (loading) {
    return (
      <main style={{ padding: "24px", textAlign: "center", color: "#006b5f" }}>
        読み込み中…🫧
      </main>
    );
  }

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
    background: "#ffffff",
    padding: "16px",
    borderRadius: "14px",
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
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "20px",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <BackButton to={`/home`} />


      <h1
        style={{
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          marginBottom: "20px",
          color: "#006b5f",
        }}
      >
        🏆 院内ランキング TOP5（総使用量）
      </h1>

      {/* タブ */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(mode === "week")} onClick={() => setMode("week")}>
          今週
        </button>
        <button style={tabStyle(mode === "month")} onClick={() => setMode("month")}>
          今月
        </button>
        <button style={tabStyle(mode === "year")} onClick={() => setMode("year")}>
          今年
        </button>
      </div>

      {/* ランキング */}
      {ranking.map((item, index) => (
        <div key={item.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(index)}</div>

          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
              {index + 1} 位：{item.name}
            </p>
            <p style={{ margin: 0, color: "#008b75", fontWeight: "bold" }}>
              {item.totalMl.toFixed(1)} mL
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
