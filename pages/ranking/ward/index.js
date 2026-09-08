"use client";

import { useEffect, useState } from "react";
import { db } from "../../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function WardRanking() {
  const router = useRouter();
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "records"));
      const records = snap.docs.map(doc => doc.data());

      const now = new Date();
      let start, end;

      if (period === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (period === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      // ★ 期間フィルタ
      const filtered = records.filter(r => {
        if (!r.date) return false;
        const t = r.date.toDate();
        if (period === "all") return true;
        return t >= start && t <= end;
      });

      // ★ wardId で集計（ここが最重要修正ポイント）
      const wardMap = {};

      filtered.forEach(item => {
        const ward = item.wardId || "不明";   // ← 修正済み
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
    <main style={{ padding: "20px", background: "#F9F9F9", minHeight: "100vh" }}>
      <button
        onClick={() => router.push("/admin")}
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
        ← 管理者トップに戻る
      </button>

      {/* タイトル */}
      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px"
        }}
      >
        <div style={{ display: "inline-flex", flexDirection: "row", alignItems: "flex-start", textAlign: "left" }}>
          <span style={{ fontSize: "32px", marginRight: "8px" }}>🫧</span>
          <span>
            病棟別<br />
            手指消毒使用量ランキング
          </span>
        </div>
      </h1>

      {/* 期間ボタン */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button onClick={() => setPeriod("today")} style={btn}>今日</button>
        <button onClick={() => setPeriod("month")} style={btn}>今月</button>
        <button onClick={() => setPeriod("all")} style={btn}>累計</button>
      </div>

      {/* ランキング表示 */}
      {data.map((item, index) => {
        let bg = "#e8f6f6";
        let border = "#cfeeee";
        let color = "#006b5f";
        let medal = "";

        if (index === 0) {
          bg = "#fff7d1";
          border = "#e6d28a";
          color = "#8c6b00";
          medal = "🥇";
        } else if (index === 1) {
          bg = "#f0f4f7";
          border = "#d0d7dd";
          color = "#5f6b78";
          medal = "🥈";
        } else if (index === 2) {
          bg = "#fbe9d9";
          border = "#e0b89b";
          color = "#8a4f2a";
          medal = "🥉";
        }

        return (
          <div
            key={index}
            style={{
              background: bg,
              padding: "16px",
              borderRadius: "12px",
              marginBottom: "12px",
              border: `1px solid ${border}`,
              color: color,
              fontSize: "18px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <span style={{ fontSize: "24px" }}>{medal}</span>
            <span>
              {index + 1}位：{item.ward}（{item.total.toFixed(2)} mL）
            </span>
          </div>
        );
      })}
    </main>
  );
}

const btn = {
  background: "#cfeeee",
  color: "#006b5f",
  border: "none",
  padding: "10px 16px",
  borderRadius: "12px",
  fontSize: "16px",
  cursor: "pointer"
};
