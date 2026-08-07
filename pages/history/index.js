"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "../../components/NavBar";

export default function HistoryPage() {
  const loginUser = JSON.parse(localStorage.getItem("loginUser") || "{}");

  const router = useRouter();

  const [history, setHistory] = useState([]);

  // ★ 修正機能の state（ここに置く）
  const [selectedRecord, setSelectedRecord] = useState(null);

  // ★ 期間別の合計
  const [totalAll, setTotalAll] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [totalWeek, setTotalWeek] = useState(0);
  const [totalMonth, setTotalMonth] = useState(0);
  const [totalYear, setTotalYear] = useState(0);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("history") || "[]");
    setHistory(data.reverse()); // 新しい順に表示

    const now = new Date();

    // ★ 判定関数
    const isToday = (date) =>
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    const isThisWeek = (date) => {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1); // 月曜
      const end = new Date(start);
      end.setDate(start.getDate() + 6); // 日曜
      return date >= start && date <= end;
    };

    const isThisMonth = (date) =>
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth();

    const isThisYear = (date) =>
      date.getFullYear() === now.getFullYear();

    // ★ 合計計算
    let all = 0, today = 0, week = 0, month = 0, year = 0;

    data.forEach((item) => {
      const d = new Date(item.time);
      const ml = Number(item.ml);

      all += ml;
      if (isToday(d)) today += ml;
      if (isThisWeek(d)) week += ml;
      if (isThisMonth(d)) month += ml;
      if (isThisYear(d)) year += ml;
    });

    setTotalAll(all);
    setTotalToday(today);
    setTotalWeek(week);
    setTotalMonth(month);
    setTotalYear(year);
  }, []);

  return (
    <main
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "24px",
        fontFamily: "sans-serif",
      }}
    >
  <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
  履歴
</h1>

<p style={{ color: "#006b5f", marginBottom: "16px", fontSize: "18px" }}>
  👤 {loginUser.name} さんの履歴
</p>





      {/* ★ 合計カード */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #cfeeee",
          borderRadius: "16px",
          padding: "20px",
          marginBottom: "24px",
          boxShadow: "0 2px 6px rgba(0, 150, 130, 0.08)",
        }}
      >
        <p style={{ color: "#006b5f", fontWeight: "bold", fontSize: "18px" }}>
          💧 今日の合計：{totalToday.toFixed(1)} mL
        </p>
        <p>今週の合計：{totalWeek.toFixed(1)} mL</p>
        <p>今月の合計：{totalMonth.toFixed(1)} mL</p>
        <p>今年の合計：{totalYear.toFixed(1)} mL</p>
        <p style={{ fontWeight: "bold", color: "#008b75", fontSize: "17px" }}>
          合計（全期間）：{totalAll.toFixed(1)} mL
        </p>
      </div>

      {history.length === 0 && (
        <p style={{ color: "#006b5f" }}>まだ記録がありません。</p>
      )}

      {/* 履歴カード一覧 */}
      {history.map((item, index) => (
        <div
          key={index}
          onClick={() => setSelectedRecord(index)}
          style={{
            background: selectedRecord === index ? "#e8f6f6" : "#ffffff",
            border: "1px solid #cfeeee",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            cursor: "pointer",
            color: "#006b5f",
          }}
        >
          {item.time}  / {item.ml} mL
        </div>
      ))}

      {/* 修正ボタン */}
      {selectedRecord !== null && (
        <button
          style={{
            marginTop: "24px",
            background: "#4BB5C1",
            color: "white",
            padding: "14px 20px",
            borderRadius: "12px",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
            width: "100%",
          }}
          onClick={() => router.push(`/history/edit?index=${selectedRecord}`)}
        >
          選択した記録を修正する
        </button>
      )}

      <NavBar />
    </main>
  );
}
