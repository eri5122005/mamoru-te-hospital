"use client";

import { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function MyPage() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);

  const [todayCount, setTodayCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [todayMl, setTodayMl] = useState(0);
  const [monthMl, setMonthMl] = useState(0);
  const [totalMl, setTotalMl] = useState(0);

  const [totalPoint, setTotalPoint] = useState(0);
  const [rank, setRank] = useState("");

  const getRank = (pt) => {
    if (pt >= 100) return "Sランク（神レベル）";
    if (pt >= 50) return "Aランク（優秀）";
    if (pt >= 20) return "Bランク（しっかり者）";
    if (pt >= 10) return "Cランク（がんばってる）";
    return "Dランク（これから！）";
  };

  const getRankColor = (rank) => {
    switch (rank[0]) {
      case "S": return "#b3f5ff";
      case "A": return "#c8fff0";
      case "B": return "#d9fff5";
      case "C": return "#e8fffa";
      case "D": return "#f2fffd";
      default: return "#e8fffa";
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem("currentStaff");
    if (!raw) return;
    const staff = JSON.parse(raw);
    setUser(staff);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadRecords(user.staffId);
  }, [user]);

  const loadRecords = async (staffId) => {
    const q = query(collection(db, "records"), where("staffId", "==", staffId));
    const snap = await getDocs(q);

    const list = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
      };
    });

    setRecords(list);

    const today = new Date();
    const todayStr = today.toLocaleDateString("ja-JP");

    const todayList = list.filter(
      (r) => r.date.toLocaleDateString("ja-JP") === todayStr
    );

    const monthList = list.filter(
      (r) =>
        r.date.getFullYear() === today.getFullYear() &&
        r.date.getMonth() === today.getMonth()
    );

    setTodayCount(todayList.length);
    setMonthCount(monthList.length);
    setTotalCount(list.length);

    setTodayMl(todayList.reduce((sum, r) => sum + (r.ml || 0), 0));
    setMonthMl(monthList.reduce((sum, r) => sum + (r.ml || 0), 0));
    setTotalMl(list.reduce((sum, r) => sum + (r.ml || 0), 0));

    const pt = list.reduce((sum, r) => sum + (r.mintPoint ?? 0), 0);
    setTotalPoint(pt);

    setRank(getRank(pt));
  };

  if (!user) return <div>ログイン情報がありません。ログインし直してください。</div>;

  return (
    <main
      style={{
        padding: "20px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
        color: "#006b5f",
      }}
    >
      {/* 戻るボタン */}
      <button
        onClick={() => history.back()}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          marginBottom: "20px",
          cursor: "pointer",
          width: "100%",
        }}
      >
        ← 戻る
      </button>

      <h1
        style={{
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          marginBottom: "20px",
        }}
      >
        👤 {user.name} さんの記録
      </h1>

      {/* 基本情報カード */}
      <InfoCard
        title="基本情報"
        icon="📄"
        content={
          <>
            <p>🆔 職員番号：{user.staffId}</p>
            <p>🏥 病棟：{user.department}</p>
            <p>📅 勤務日数：{user.workDays} 日</p>
          </>
        }
      />

      {/* 使用量カード */}
      <InfoCard
        title="使用量（mL）"
        icon="🧴"
        content={
          <>
            <p>今日：{todayMl.toFixed(1)} ml</p>
            <p>今月：{monthMl.toFixed(1)} ml</p>
            <p>累計：{totalMl.toFixed(1)} ml</p>
          </>
        }
      />

      {/* 記録回数カード */}
      <InfoCard
        title="記録回数"
        icon="📝"
        content={
          <>
            <p>今日：{todayCount} 回</p>
            <p>今月：{monthCount} 回</p>
            <p>累計：{totalCount} 回</p>
          </>
        }
      />

      {/* ミントポイントカード */}
      <InfoCard
        title="ミントポイント"
        icon="🍃"
        content={<p>累計：{totalPoint} pt</p>}
      />

      {/* ランクカード */}
      <div
        style={{
          background: getRankColor(rank),
          padding: "16px",
          borderRadius: "14px",
          marginTop: "20px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ margin: 0 }}>🏆 ランク</h2>
        <p style={{ fontSize: "20px", marginTop: "6px" }}>{rank}</p>
      </div>

      {/* 記録一覧 */}
      <h2 style={{ marginTop: "30px" }}>📚 記録一覧</h2>

      {records.map((r) => (
        <div
          key={r.id}
          style={{
            background: "#fff",
            padding: "12px",
            marginBottom: "10px",
            borderRadius: "10px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          }}
        >
          <p>⏰ {r.date.toLocaleString("ja-JP")}</p>
          <p>📏 使用量：{r.amount} cm</p>
          <p>💧 ml換算：{r.ml} ml</p>
          <p>🍃 ミントポイント：{r.mintPoint ?? 0}</p>
        </div>
      ))}
    </main>
  );
}

function InfoCard({ title, icon, content }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "16px",
        border: "1px solid #cfeeee",
      }}
    >
      <p
        style={{
          color: "#006b5f",
          fontSize: "18px",
          marginBottom: "10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        {icon} {title}
      </p>
      <div style={{ color: "#006b5f", fontSize: "16px" }}>{content}</div>
    </div>
  );
}
