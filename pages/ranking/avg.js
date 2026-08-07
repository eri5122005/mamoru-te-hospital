"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AvgRanking() {
  const router = useRouter();
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");
    const history = JSON.parse(localStorage.getItem("history") || "[]");

    // スタッフごとの合計使用量を計算
    const staffTotals = staffList.map(staff => {
      const totalMl = history
        .filter(item => item.staffId === staff.staffId)
        .reduce((sum, item) => sum + Number(item.ml), 0);

      return {
        name: staff.name,
        department: staff.department,
        workDays: staff.workDays,
        totalMl,
        avgMl: staff.workDays > 0 ? totalMl / staff.workDays : 0
      };
    });

    // 平均使用量ランキング（降順）
    const avgRanking = [...staffTotals].sort((a, b) => b.avgMl - a.avgMl);

    setRanking(avgRanking);
  }, []);

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px", textAlign: "center" }}>
        勤務日数を考慮した平均使用量ランキング（mL/日）
      </h1>

      <div
        onClick={() => router.push("/ranking")}
        style={{
          background: "#e8f6f6",
          padding: "14px",
          borderRadius: "12px",
          textAlign: "center",
          cursor: "pointer",
          color: "#006b5f",
          marginBottom: "24px"
        }}
      >
        ← ランキングメニューに戻る
      </div>

      {/* ★ カードUIのランキング */}
      {ranking.map((s, i) => (
        <div
          key={s.staffId}
          style={{
            background: "#ffffff",
            padding: "20px",
            borderRadius: "16px",
            marginBottom: "20px",
            border: "1px solid #cfeeee",
            display: "flex",
            alignItems: "center",
            gap: "16px"
          }}
        >
          {/* 順位バッジ */}
          <div
            style={{
              background: "#cfeeee",
              color: "#006b5f",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: "bold"
            }}
          >
            {i + 1}
          </div>

          {/* 名前とデータ */}
          <div style={{ color: "#006b5f" }}>
            <h3 style={{ margin: "0 0 6px 0" }}>
              {s.name}（{s.department}）
            </h3>
            <p style={{ margin: 0 }}>勤務日数：{s.workDays} 日</p>
            <p style={{ margin: 0 }}>平均使用量：{s.avgMl.toFixed(1)} mL/日</p>
          </div>
        </div>
      ))}
    </main>
  );
}
