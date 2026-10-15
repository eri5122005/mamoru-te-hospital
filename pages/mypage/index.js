"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecordDate } from "@/utils/getRecordDate";
import { getMintPoints } from "@/utils/getMintPoints";
import { getMypageMonthSummary, getMonthlyInputStatus, getMypageUsageTrend } from "@/utils/getMypageMonthSummary";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function MyPage() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);

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

    setTodayMl(todayList.reduce((sum, r) => sum + (r.ml || 0), 0));
    setMonthMl(monthList.reduce((sum, r) => sum + (r.ml || 0), 0));
    setTotalMl(list.reduce((sum, r) => sum + (r.ml || 0), 0));

    const pt = getMintPoints(list);
    setTotalPoint(pt);

  };

  const recentRecords = [...records]
    .sort((a, b) => (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity))
    .slice(0, 5);
  const monthly = getMypageMonthSummary(records);
  const usageTrend = getMypageUsageTrend(records);
  const inputStatus = getMonthlyInputStatus(monthly.recordedDays, user?.workDays);
  const comparisonFeedback = monthly.previousRecordCount === 0
    ? {
      title: "✨ 今月も守る一手、記録中！",
      body: "先月同時期は比較できる記録がありません。",
      encouragement: "記録を続けて、自分の使用量の変化を確認していきましょう。",
    }
    : monthly.difference > 0
    ? {
      title: "🌿 守る一手、積み重なっています！",
      body: `先月同時期より ${monthly.difference.toFixed(1)}mL増えています。`,
      encouragement: "この調子で、日々の手指衛生を続けていきましょう。",
    }
    : monthly.difference < 0
      ? {
        title: "🫧 今月の使用量を振り返ってみましょう",
        body: `先月同時期より ${Math.abs(monthly.difference).toFixed(1)}mL少なくなっています。`,
        encouragement: "日々の手指衛生を意識するきっかけにしていきましょう。",
      }
      : {
        title: "🌿 守る一手、記録中！",
        body: "先月同時期と同じ使用量です。",
        encouragement: "この調子で、日々の手指衛生を続けていきましょう。",
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

      <InfoCard
        title="使用量の推移"
        icon="📊"
        content={
          usageTrend.length === 0 ? <p>今月の記録はまだありません</p> : (
            <>
              <div style={{ position: "relative", height: "240px", width: "100%", minWidth: 0 }}>
                <Bar
                  role="img"
                  aria-label="今月の記録日ごとの使用量合計"
                  data={{
                    labels: usageTrend.map((point) => point.label),
                    datasets: [{
                      label: "使用量（mL）",
                      data: usageTrend.map((point) => point.ml),
                      borderColor: "#00a39a",
                      backgroundColor: "#00a39a",
                      borderWidth: 2,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: {
                      callbacks: {
                        title: (items) => items.length ? usageTrend[items[0].dataIndex].label : "",
                        label: (context) => `${context.parsed.y.toFixed(1)} mL`,
                      },
                    } },
                    scales: {
                      x: { title: { display: true, text: "記録日" }, ticks: { maxRotation: 0, maxTicksLimit: 6 } },
                      y: { beginAtZero: true, title: { display: true, text: "使用量（mL）" } },
                    },
                  }}
                />
              </div>
              <p style={{ fontSize: "12px", lineHeight: 1.6 }}>
                同じ日に記録した使用量を合計して表示しています。
              </p>
            </>
          )
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
            <p>先月同時期：{monthly.previousRecordCount === 0 ? "記録なし" : `${monthly.previousMl.toFixed(1)} mL`}</p>
            <div style={{ marginTop: "16px", lineHeight: 1.8 }}>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 8px" }}>
                {comparisonFeedback.title}
              </h2>
              <p style={{ fontSize: "14px", margin: 0 }}>
                {comparisonFeedback.body}<br />
                {comparisonFeedback.encouragement}
              </p>
            </div>
          </>
        }
      />

      <InfoCard
        title="今月の入力状況"
        icon="📝"
        content={
          <>
            <p>記録日数：{monthly.recordedDays}{inputStatus.workDays === null ? "日" : ` / ${inputStatus.workDays}日`}</p>
            <p>入力率：{inputStatus.rate === null ? "—" : `${inputStatus.rate}%`}</p>
            {inputStatus.workDays === null ? (
              <p style={{ fontSize: "14px" }}>基本月間勤務日数が未設定、または正しく設定されていないため、入力率を表示できません。</p>
            ) : (
              <div
                role="progressbar"
                aria-label="今月の入力率"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={inputStatus.rate}
                style={{ background: "#cfeeee", height: "10px", borderRadius: "10px", overflow: "hidden" }}
              >
                <div style={{ background: "#00a39a", height: "100%", width: `${inputStatus.rate}%` }} />
              </div>
            )}
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
