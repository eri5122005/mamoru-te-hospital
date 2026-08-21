"use client";

import { useEffect, useState } from "react";
import { db } from "../../../firebaseConfig";

import { collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function WardRanking() {
  const router = useRouter();
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const staff = JSON.parse(localStorage.getItem("currentStaff"));
      if (!staff) return;

      // ★ Firestore から「自分の病棟の記録だけ」取得
      const q = query(
        collection(db, "records"),
        where("wardId", "==", staff.wardId)
      );

      const snap = await getDocs(q);
      const records = snap.docs.map(doc => doc.data());

      const now = new Date(Date.now() + 9 * 60 * 60 * 1000);


      // ★ 期間で絞り込み（クラウド版）
      const filtered = records.filter(item => {
        const t = item.date.toDate();

        const jst = new Date(t.getTime() + 9 * 60 * 60 * 1000);

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

        return true; // 累計
      });

      // ★ 病棟別集計（クラウド版）
      const wardMap = {};

      filtered.forEach(item => {
        const ward = item.department || "不明";
        const ml = Number(item.ml) || 0;

        if (!wardMap[ward]) wardMap[ward] = 0;
        wardMap[ward] += ml;
      });

      const ranking = Object.entries(wardMap)
        .map(([ward, total]) => ({ ward, total }))
        .sort((a, b) => b.total - a.total);

      setData(ranking);
    };

    load();
  }, [period]);

  return (
    <main
      style={{
        padding: "20px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif"
      }}
    >
      <button
        onClick={() => router.push("/ranking")}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "20px",
          width: "100%"
        }}
      >
        ← ランキングメニューに戻る
      </button>

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px"
        }}
      >
        🌱 病棟別ランキング（クラウド版）
      </h1>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => setPeriod("today")} style={periodButtonStyle}>今日</button>
        <button onClick={() => setPeriod("month")} style={periodButtonStyle}>今月</button>
        <button onClick={() => setPeriod("year")} style={periodButtonStyle}>今年</button>
        <button onClick={() => setPeriod("all")} style={periodButtonStyle}>累計</button>
      </div>

      {data.map((item, index) => (
        <div
          key={index}
          style={{
            background: "#e8f6f6",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "12px",
            border: "1px solid #cfeeee",
            color: "#006b5f",
            fontSize: "18px"
          }}
        >
          {index + 1}位：{item.ward}（{item.total.toFixed(1)} mL）
        </div>
      ))}
    </main>
  );
}

const periodButtonStyle = {
  background: "#cfeeee",
  color: "#006b5f",
  border: "none",
  padding: "10px 16px",
  borderRadius: "12px",
  fontSize: "16px",
  cursor: "pointer"
};
