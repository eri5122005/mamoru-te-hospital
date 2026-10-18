"use client";

import { getWorkDays } from "@/utils/getWorkDays";
import { isRankingUsageVisible } from "@/utils/isRankingUsageVisible";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import BackButton from "@/components/BackButton";

import { useEffect, useState } from "react";
import { db } from "../../../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function AvgRanking() {
  // ★ from=admin を受け取る
  const searchParams = useSearchParams();
  const fromAdmin = searchParams.get("from") === "admin";

  const router = useRouter();
  const { wardId } = router.query;

  // ★ 戻る先を分岐
  const backTo = fromAdmin
    ? `/admin/ward/${wardId}?from=admin`
    : `/admin/ward/${wardId}`;

  const [monthLabel, setMonthLabel] = useState("");
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    if (!router.isReady || typeof wardId !== "string" || !wardId) return;

    const load = async () => {
      const staff = JSON.parse(localStorage.getItem("currentStaff"));
      if (!staff) return;

      const q = query(
        collection(db, "records"),
        where("wardId", "==", wardId)
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(doc => doc.data());

      const staffSnap = await getDocs(
        query(collection(db, "staff"), where("wardId", "==", wardId))
      );
      const staffList = staffSnap.docs.map(doc => doc.data());
      const staffMap = {};
      staffList.forEach(s => {
        if (s.staffId) {
          staffMap[s.staffId] = s;
        }
      });

      const now = new Date();

      const japanMonth = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "numeric",
      });
      const getJstParts = (date) => {
        const parts = japanMonth.formatToParts(date);
        const part = (type) => parts.find((item) => item.type === type).value;
        return { year: part("year"), month: part("month") };
      };
      const current = getJstParts(now);
      setMonthLabel(`📅 ${current.year}年${current.month}月`);

      const filtered = records.filter(item => {
        if (typeof item.date?.toDate !== "function") return false;
        const date = item.date.toDate();
        if (!Number.isFinite(date.getTime())) return false;
        const recordMonth = getJstParts(date);
        return recordMonth.year === current.year && recordMonth.month === current.month;
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

      const rankingData = Object.values(map)
        .map(s => {
          const staffInfo = staffMap[s.staffId] || {};
          const workDays = getWorkDays(staffInfo.workDays);

          return {
            staffId: s.staffId,
            name: s.name,
            department: s.department,
            workDays,
            avgMl: workDays !== null ? s.totalMl / workDays : 0,
          };
        })
        .filter((item) => isRankingUsageVisible(item.avgMl))
        .sort((a, b) => b.avgMl - a.avgMl);

      setRanking(rankingData);
    };

    load();
  }, [router.isReady, wardId]);

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
      {/* ★ 修正済み：fromAdmin に応じて戻る */}
      <BackButton to={backTo} />

      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <div style={{ fontSize: "22px", fontWeight: "600", color: "#006b5f" }}>
          📈 勤務日数を考慮した
        </div>
        <div style={{ fontSize: "22px", fontWeight: "600", color: "#006b5f" }}>
          使用量ランキング
        </div>
      </div>

      <div style={{ textAlign: "center", margin: "0 0 12px" }}>
        <span style={{ display: "inline-block", background: "#e8f6f6", border: "1px solid #cfeeee", color: "#006b5f", borderRadius: "20px", padding: "6px 14px", fontSize: "15px", fontWeight: "bold" }}>
          {monthLabel}
        </span>
      </div>
      <p style={{ fontSize: "13px", lineHeight: 1.7, margin: "0 0 20px" }}>
        今月の使用量を、登録されている月の勤務日数で割った参考値です。
        実際の1勤務あたり使用量を示すものではありません。
      </p>

      {ranking.length === 0 && (
        <p style={{ color: "#006b5f" }}>今月に使用量のある職員はいません</p>
      )}

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
              勤務日数考慮：{s.avgMl.toFixed(1)} mL
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
