"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecordDate } from "@/utils/getRecordDate";
import { getMypageMonthSummary } from "@/utils/getMypageMonthSummary";
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
        date: getRecordDate(data.date),
      };
    });

    setRecords(list);

    const today = new Date();
    const todayStr = today.toLocaleDateString("ja-JP");

    const todayList = list.filter(
      (r) => r.date?.toLocaleDateString("ja-JP") === todayStr
    );

    const monthList = list.filter(
      (r) =>
        r.date && r.date.getFullYear() === today.getFullYear() &&
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

  };

  const recentRecords = [...records]
    .sort((a, b) => (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity))
    .slice(0, 5);
  const monthly = getMypageMonthSummary(records);
  const comparisonMessage = monthly.difference > 0
    ? `先月同時期より ${monthly.difference.toFixed(1)} mL 増えています`
    : monthly.difference < 0
      ? `先月同時期より ${Math.abs(monthly.difference).toFixed(1)} mL 少なくなっています`
      : "先月同時期と同じ使用量です";

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

      <InfoCard
        title="今月のチャレンジ"
        icon="🏆"
        content={
          <>
            <p style={{ fontWeight: "bold", fontSize: "18px" }}>{monthly.challenge.title}</p>
            <p>{monthly.challenge.detail}</p>
            {monthly.recordedDays < 20 && <p>今月 {monthly.recordedDays}日記録</p>}
            <div
              role="progressbar"
              aria-label="今月の記録日数（20日で達成）"
              aria-valuemin={0}
              aria-valuemax={20}
              aria-valuenow={Math.min(monthly.recordedDays, 20)}
              aria-valuetext={`今月${monthly.recordedDays}日記録`}
              style={{ background: "#cfeeee", height: "10px", borderRadius: "10px", overflow: "hidden" }}
            >
              <div style={{ background: "#00a39a", height: "100%", width: `${monthly.challenge.progress}%` }} />
            </div>
          </>
        }
      />

      <InfoCard
        title="先月同時期との比較"
        icon="📊"
        content={
          <>
            <p style={{ fontSize: "13px" }}>
              今月：{monthly.currentMonth}/1～{monthly.currentMonth}/{monthly.currentEndDay}<br />
              先月：{monthly.previousMonth}/1～{monthly.previousMonth}/{monthly.previousEndDay}
            </p>
            <p>今月：{monthly.currentMl.toFixed(1)} mL</p>
            <p>先月同時期：{monthly.previousMl.toFixed(1)} mL</p>
            <p style={{ fontWeight: "bold" }}>{comparisonMessage}</p>
          </>
        }
      />

      {/* ミントポイントカード */}
      <InfoCard
        title="累計ミントポイント"
        icon="🍃"
        content={<p>累計：{totalPoint} pt</p>}
      />

      {/* 最近の記録（集計は全履歴を使用） */}
      <h2 style={{ marginTop: "30px", fontSize: "20px" }}>📚 最近の記録</h2>
      <div style={{ background: "#fff", border: "1px solid #cfeeee", borderRadius: "14px", padding: "4px 12px" }}>
        {recentRecords.length === 0 && <p>まだ記録がありません。</p>}
        {recentRecords.map((r, index) => (
          <div
            key={r.id}
            style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "6px 12px", padding: "12px 0", borderTop: index > 0 ? "1px solid #e8f6f6" : "none", fontSize: "14px" }}
          >
            <span style={{ whiteSpace: "nowrap" }}>
              {r.date ? r.date.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "日付不明"}
            </span>
            <span style={{ whiteSpace: "nowrap", fontWeight: "bold" }}>💧 使用量：{r.ml} mL</span>
          </div>
        ))}
      </div>
      <Link href="/history" style={{ display: "block", textAlign: "center", background: "#cfeeee", color: "#006b5f", padding: "14px 10px", borderRadius: "12px", marginTop: "12px", fontSize: "15px" }}>
        すべての履歴を見る ＞
      </Link>
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
