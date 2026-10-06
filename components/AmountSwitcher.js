"use client";

import { useState, useEffect } from "react";

export default function AmountSwitcher() {
  const [mode, setMode] = useState("yesterday");
  const [total, setTotal] = useState(0);

  const loadData = async (type) => {
  const url =
    type === "yesterday"
      ? "/api/admin/amount-yesterday"   // ← これは eri の仕様で正しい
      : "/api/admin/todayTotal";        // ← 今日の API 名を正しく修正

  const res = await fetch(url);
const json = await res.json();

console.log("APIの返却データ:", json);   // ← ここに入れる！

  if (type === "yesterday") {
    const sum = json.reduce((acc, s) => acc + Number(s.total || 0), 0);
    setTotal(sum);
  } else {
    setTotal(Number(json.total || 0));
  }
};

  useEffect(() => {
    loadData("yesterday");
  }, []);

  const handleSwitch = () => {
    const next = mode === "yesterday" ? "today" : "yesterday";
    setMode(next);
    loadData(next);
  };

  return (
    <div style={{ marginBottom: "30px" }}>
      <h2 style={{ fontSize: "22px", color: "#006b5f", marginBottom: "12px" }}>
        {mode === "yesterday" ? "昨日の総使用量" : "今日の総使用量"}
      </h2>

      <button
        onClick={handleSwitch}
        style={{
          padding: "10px 16px",
          background: "#dff7f4",
          borderRadius: "10px",
          border: "1px solid #bfe9e4",
          color: "#006b5f",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        {mode === "yesterday"
          ? "今日の使用量を見る →"
          : "昨日の使用量に戻す ←"}
      </button>

      {/* かわいいミントカード */}
      <div
        style={{
          background: "linear-gradient(135deg, #f9fdfd 0%, #e8f8f6 100%)",
          borderRadius: "18px",
          padding: "22px",
          border: "1px solid #cfeeee",
          minHeight: "150px",
          display: "flex",
          alignItems: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          animation: "fadeIn 0.4s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* ミントバッジアイコン */}
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "#cfeeee",
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "34px",
              color: "#006b5f",
            }}
          >
            💠
          </div>

          <div>
            <div style={{ fontSize: "18px", color: "#006b5f" }}>
              {mode === "yesterday" ? "昨日の総使用量" : "今日の総使用量"}
            </div>

            <div
              style={{
                fontSize: "32px",
                fontWeight: "700",
                marginTop: "6px",
                color: "#006b5f",
              }}
            >
              {total.toFixed(2)} mL
            </div>
          </div>
        </div>
      </div>

      {/* アニメーション */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
