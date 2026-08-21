"use client";

import { messages } from "../../data/messages";
import NavBar from "../../components/NavBar";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function RecordPage() {
  const router = useRouter();
  const ML_PER_CM = 23.8;

  const randomMessage =
    messages[Math.floor(Math.random() * messages.length)];

  const [cm, setCm] = useState("");
  const [gram, setGram] = useState("");
  const [message, setMessage] = useState("");
  const [staff, setStaff] = useState(null);
  const [mintPoint, setMintPoint] = useState(0);
  const [mode, setMode] = useState("cm");

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("currentStaff"));
    if (!data) {
      router.replace("/login");
      return;
    }
    setStaff(data);

   
  }, []);

  const handleRecord = async () => {
    const value = mode === "cm" ? cm : gram;

    if (!value) {
      setMessage("量を入力してください");
      return;
    }

    const mlFromGram = mode === "g" ? (gram / 0.864) : 0;

    const usedMl =
      mode === "cm"
        ? Number((cm * ML_PER_CM).toFixed(1))
        : Number(mlFromGram.toFixed(1));

    

   // ★ クラウド保存（最重要）
try {
  await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
   body: JSON.stringify({
  staffId: staff.staffId,
  name: staff.name,
  department: staff.department,
  wardId: staff.wardId,
  amount: Number(value),
  unit: mode,
  ml: usedMl,
  mintPoint: 1,   // ← ★ここに追加！
}),

  });
} catch (error) {
  setMessage("クラウド保存に失敗しました");
  return;
}


// ★ ローカル履歴を保存（履歴ページ用）
const history = JSON.parse(localStorage.getItem("history") || "[]");

history.push({
  staffId: staff.staffId,
  name: staff.name,
  department: staff.department,
  wardId: staff.wardId,
  amount: Number(value),
  unit: mode,
  ml: usedMl,
  date: new Date().toISOString(),
});

localStorage.setItem("history", JSON.stringify(history));

    // ★ メッセージ表示
    setMessage(
      mode === "cm"
        ? `記録しました：${cm}cm → ${usedMl}mL（ミントポイント +1）\n${randomMessage}`
        : `記録しました：${gram}g → ${usedMl}mL（ミントポイント +1）\n${randomMessage}`
    );

    setCm("");
    setGram("");

    setTimeout(() => setMessage(""), 6000);
  };

  if (!staff) return <p>スタッフ情報を読み込んでいます…</p>;

  return (
    <div
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "16px",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <main>
        <h1 style={{ color: "#006b5f", marginBottom: "10px" }}>今日の記録</h1>

        <div
          style={{
            background: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            border: "1px solid #cfeeee"
          }}
        >
          <p>職員番号：{staff.staffId}</p>
          <p>名前：{staff.name}</p>
          <p>病棟：{staff.department}</p>
         
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <button
            onClick={() => setMode("cm")}
            style={{
              background: mode === "cm" ? "#cfeeee" : "#e8f6f6",
              color: "#006b5f",
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              flex: 1
            }}
          >
            cm入力
          </button>

          <button
            onClick={() => setMode("g")}
            style={{
              background: mode === "g" ? "#cfeeee" : "#e8f6f6",
              color: "#006b5f",
              padding: "10px 16px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              flex: 1
            }}
          >
            g入力
          </button>
        </div>

        <div
          style={{
            background: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            border: "1px solid #cfeeee"
          }}
        >
          <label style={{ color: "#006b5f" }}>
            今日使った量（{mode === "cm" ? "cm" : "g"}）
          </label>

          {mode === "cm" ? (
            <input
              type="number"
              value={cm}
              onChange={(e) => setCm(e.target.value)}
              placeholder="例：2.3（cm）"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #cfeeee",
                marginTop: "8px",
                fontSize: "16px"
              }}
            />
          ) : (
            <input
              type="number"
              value={gram}
              onChange={(e) => setGram(e.target.value)}
              placeholder="例：50（g）"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #cfeeee",
                marginTop: "8px",
                fontSize: "16px"
              }}
            />
          )}
        </div>

        {message && (
          <div
            style={{
              background: "#dffef5",
              color: "#008b75",
              padding: "16px",
              borderRadius: "16px",
              textAlign: "center",
              marginBottom: "20px",
              fontSize: "18px",
              fontWeight: "bold",
              transition: "all 0.3s ease",
              boxShadow: "0 0 8px rgba(0, 150, 130, 0.15)"
            }}
          >
            {message}
          </div>
        )}

        <button
          onClick={handleRecord}
          style={{
            width: "100%",
            padding: "16px",
            background: "#cfeeee",
            border: "none",
            borderRadius: "12px",
            fontSize: "20px",
            color: "#006b5f",
            cursor: "pointer"
          }}
        >
          ＋ 記録する
        </button>

        <NavBar />
      </main>
    </div>
  );
}
