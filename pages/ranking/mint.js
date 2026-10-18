"use client";

import { isActiveStaff } from "@/utils/isActiveStaff";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getMintRanking } from "@/utils/getMintPoints";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function MintRanking() {
  const router = useRouter();
  const [period, setPeriod] = useState("month");
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const load = async () => {
      const staff = JSON.parse(localStorage.getItem("currentStaff"));
      if (!staff) return;

      const staffSnap = await getDocs(
        query(collection(db, "staff"), where("wardId", "==", staff.wardId))
      );
      const activeIds = new Set(
        staffSnap.docs.map(doc => doc.data()).filter(isActiveStaff).map(s => s.staffId)
      );

      const q = query(
        collection(db, "records"),
        where("wardId", "==", staff.wardId)
      );

      const snap = await getDocs(q);
      const records = snap.docs.map(doc => doc.data()).filter(record => activeIds.has(record.staffId));

      const sorted = getMintRanking(records, period);

      setRanking(sorted);
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
    return "🌿";
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
    width: "100%",
  }}
>
  ← ランキングメニューに戻る
</button>

<h1
  style={{
    color: "#006b5f",
    marginBottom: "10px",
    textAlign: "center",
    fontSize: "26px",
    fontWeight: "600",
  }}
>
  <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
    🌿 ミントポイント
  </span>
  <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
    ランキング
  </span>
</h1>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <button style={tabStyle(period === "month")} onClick={() => setPeriod("month")}>今月</button>
        <button style={tabStyle(period === "year")} onClick={() => setPeriod("year")}>今年</button>
        <button style={tabStyle(period === "all")} onClick={() => setPeriod("all")}>累計</button>
      </div>

      {ranking.length === 0 && (
        <p style={{ color: "#006b5f" }}>まだ記録がありません。</p>
      )}

      {ranking.map((item, index) => (
        <div key={item.staffId} style={cardStyle}>
          <div style={iconBoxStyle}>{getRankIcon(index)}</div>

          <div>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "18px" }}>
              {index + 1} 位：{item.name}
            </p>
            <p style={{ margin: 0, color: "#00a68c", fontWeight: "bold" }}>
              {item.mintPoint} pt
            </p>
          </div>
        </div>
      ))}
    </main>
  );
}
