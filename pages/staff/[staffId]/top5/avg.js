"use client";

import { isActiveStaff } from "@/utils/isActiveStaff";

import { getWorkDays } from "@/utils/getWorkDays";
import { isRankingUsageVisible } from "@/utils/isRankingUsageVisible";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import BackButton from "@/components/BackButton";
import { db } from "../../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function AvgTop5Page() {
  const router = useRouter();
  const { staffId } = router.query;

  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!staffId) return;

    const load = async () => {
      setLoading(true);

      // 全スタッフ
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs.map((d) => d.data()).filter(isActiveStaff);

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
        }).formatToParts(date);

        const getPart = (type) =>
          parts.find((part) => part.type === type)?.value;

        return {
          year: Number(getPart("year")),
          month: Number(getPart("month")),
        };
      };

      const nowJst = getJstParts(now);

      // 期間フィルタ
      const filtered = records.filter((r) => {
        if (!r.date || typeof r.date.toDate !== "function") {
          return false;
        }

        // Firestore Timestamp → 絶対時刻 → JSTの日付情報へ変換
        const recordDate = r.date.toDate();
        const recordJst = getJstParts(recordDate);

        return (
          recordJst.year === nowJst.year &&
          recordJst.month === nowJst.month
        );
      });

      // 職員ごとに今月の使用量を登録月間勤務日数で補正
      const result = staffList.map((s) => {
        const myRecords = filtered.filter(
          (r) => String(r.staffId) === String(s.staffId)
        );

        const totalMl = myRecords.reduce(
          (sum, r) => sum + Number(r.ml || 0),
          0
        );

        const workDays = getWorkDays(s.workDays);
        const avgMl = workDays !== null
          ? totalMl / workDays
          : 0;

        return {
          staffId: s.staffId,
          name: s.name,
          department: s.department,
          avgMl,
          totalMl,
          workDays,
        };
      }).filter((item) => isRankingUsageVisible(item.avgMl));

      // ソートして TOP10
      result.sort((a, b) => b.avgMl - a.avgMl);
      setRanking(result.slice(0, 10));

      setLoading(false);
    };

    load();
  }, [staffId]);

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
    flexShrink: 0,
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
        📈 院内 勤務日数考慮 TOP10
      </h1>

      <p style={{ textAlign: "center", fontWeight: "bold", margin: "0 0 8px" }}>今月</p>
      <p style={{ fontSize: "13px", lineHeight: 1.7, margin: "0 0 20px" }}>
        今月の使用量を、登録されている月の勤務日数で割った参考値です。
        実際の1勤務あたり使用量を示すものではありません。
      </p>

      {/* ランキング */}
      {ranking.length === 0 && (
        <p style={{ color: "#006b5f" }}>今月に使用量のある職員はいません</p>
      )}

      {ranking.map((item, index) => (
        <div key={item.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(index)}</div>

          <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            <p
              style={{
                margin: 0,
                fontWeight: "bold",
                fontSize: "18px",
              }}
            >
              {index + 1} 位：{item.name}
            </p>
            <p style={{ margin: 0, fontSize: "14px", whiteSpace: "nowrap" }}>
              （{item.department}）
            </p>

            <p
              style={{
                margin: 0,
                color: "#008b75",
                fontWeight: "bold",
              }}
            >
              勤務日数考慮：{item.avgMl.toFixed(1)} mL
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
