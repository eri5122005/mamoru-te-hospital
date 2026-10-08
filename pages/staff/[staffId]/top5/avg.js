"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import BackButton from "@/components/BackButton";
import { db } from "../../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function AvgTop5Page() {
  const router = useRouter();
  const { staffId } = router.query;

  const [ranking, setRanking] = useState([]);
  const [mode, setMode] = useState("week"); // week / month / year
  const [loading, setLoading] = useState(true);

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

      // 現在時刻をJSTとして扱うための情報を取得
      const now = new Date();

      const getJstParts = (date) => {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          weekday: "short",
        }).formatToParts(date);

        const getPart = (type) =>
          parts.find((part) => part.type === type)?.value;

        const weekdayMap = {
          Sun: 0,
          Mon: 1,
          Tue: 2,
          Wed: 3,
          Thu: 4,
          Fri: 5,
          Sat: 6,
        };

        return {
          year: Number(getPart("year")),
          month: Number(getPart("month")),
          day: Number(getPart("day")),
          weekday: weekdayMap[getPart("weekday")],
        };
      };

      const nowJst = getJstParts(now);

      // JSTで今週の日曜日を求める
      const todayAsUtc = new Date(
        Date.UTC(nowJst.year, nowJst.month - 1, nowJst.day)
      );

      todayAsUtc.setUTCDate(
        todayAsUtc.getUTCDate() - nowJst.weekday
      );

      const startOfWeek = {
        year: todayAsUtc.getUTCFullYear(),
        month: todayAsUtc.getUTCMonth() + 1,
        day: todayAsUtc.getUTCDate(),
      };

      // YYYYMMDD の数値にして日付を比較する
      const toDateNumber = (year, month, day) =>
        year * 10000 + month * 100 + day;

      const todayNumber = toDateNumber(
        nowJst.year,
        nowJst.month,
        nowJst.day
      );

      const startOfWeekNumber = toDateNumber(
        startOfWeek.year,
        startOfWeek.month,
        startOfWeek.day
      );

      // 期間フィルタ
      const filtered = records.filter((r) => {
        if (!r.date || typeof r.date.toDate !== "function") {
          return false;
        }

        // Firestore Timestamp → 絶対時刻 → JSTの日付情報へ変換
        const recordDate = r.date.toDate();
        const recordJst = getJstParts(recordDate);

        if (mode === "week") {
          const recordNumber = toDateNumber(
            recordJst.year,
            recordJst.month,
            recordJst.day
          );

          return (
            recordNumber >= startOfWeekNumber &&
            recordNumber <= todayNumber
          );
        }

        if (mode === "month") {
          return (
            recordJst.year === nowJst.year &&
            recordJst.month === nowJst.month
          );
        }

        if (mode === "year") {
          return recordJst.year === nowJst.year;
        }

        return true;
      });

      // スタッフごとに集計（平均使用量 = 総使用量 / 勤務日数）
      const result = staffList.map((s) => {
        const myRecords = filtered.filter(
          (r) => String(r.staffId) === String(s.staffId)
        );

        const totalMl = myRecords.reduce(
          (sum, r) => sum + Number(r.ml || 0),
          0
        );

        const workDays = Number(s.workDays || 1); // 勤務日数が 0 の人を防ぐ
        const avgMl = totalMl / workDays;

        return {
          staffId: s.staffId,
          name: s.name,
          avgMl,
          totalMl,
          workDays,
        };
      });

      // ソートして TOP10
      result.sort((a, b) => b.avgMl - a.avgMl);
      setRanking(result.slice(0, 10));

      setLoading(false);
    };

    load();
  }, [staffId, mode]);

  if (loading) {
    return (
      <main
        style={{
          padding: "24px",
          textAlign: "center",
          color: "#006b5f",
        }}
      >
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
    return "🫧";
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
        📈 平均使用量ランキング TOP10
      </h1>

      {/* タブ */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        <button
          style={tabStyle(mode === "week")}
          onClick={() => setMode("week")}
        >
          今週
        </button>

        <button
          style={tabStyle(mode === "month")}
          onClick={() => setMode("month")}
        >
          今月
        </button>

        <button
          style={tabStyle(mode === "year")}
          onClick={() => setMode("year")}
        >
          今年
        </button>
      </div>

      {/* ランキング */}
      {ranking.map((item, index) => (
        <div key={item.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(index)}</div>

          <div>
            <p
              style={{
                margin: 0,
                fontWeight: "bold",
                fontSize: "18px",
              }}
            >
              {index + 1} 位：{item.name}
            </p>

            <p
              style={{
                margin: 0,
                color: "#008b75",
                fontWeight: "bold",
              }}
            >
              平均 {item.avgMl.toFixed(1)} mL / 日
            </p>

            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "#006b5f",
              }}
            >
              （総使用量: {item.totalMl.toFixed(1)} mL / 勤務日数:{" "}
              {item.workDays} 日）
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}