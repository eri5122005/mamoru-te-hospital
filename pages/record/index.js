"use client";

import { messages } from "../../data/messages";
import NavBar from "../../components/NavBar";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RecordPage() {
  const router = useRouter();
  const ML_PER_CM = 23.8;

  const randomMessage =
    messages[Math.floor(Math.random() * messages.length)];

  const [cm, setCm] = useState("");
  const [message, setMessage] = useState("");
  const [staff, setStaff] = useState(null);
  const [mintPoint, setMintPoint] = useState(0);

  // ★ 修正機能
  const [lastRecordIndex, setLastRecordIndex] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [mode, setMode] = useState("cm"); // cm入力かg入力か
const [gram, setGram] = useState("");   // g入力用


  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("currentStaff"));
    setStaff(data);

    const point = Number(localStorage.getItem("mintPoint") || 0);
    setMintPoint(point);

    const loginUser = JSON.parse(localStorage.getItem("loginUser"));
    if (!loginUser) {
      router.push("/login");
      return;
    }
  }, []);

  // ★ 記録処理
 const handleRecord = () => {
  const value = mode === "cm" ? cm : gram;

  if (!value) {
    setMessage("量を入力してください");
    return;
  }

  // g → mL の換算（250mL = 216g）
  const mlFromGram = mode === "g" ? (gram / 0.864) : 0;

  const usedMl =
    mode === "cm"
      ? (cm * ML_PER_CM).toFixed(1)
      : mlFromGram.toFixed(1);

  const now = new Date().toLocaleString();   // ← ★必須！

  const history = JSON.parse(localStorage.getItem("history") || "[]");

  history.push({
    time: now,
    staffId: staff.staffId,
    name: staff.name,
    department: staff.department,
    cm: mode === "cm" ? cm : null,   // ← cm入力時だけ保存
    gram: mode === "g" ? gram : null, // ← g入力時だけ保存
    ml: usedMl
  });

  setLastRecordIndex(history.length - 1);
  localStorage.setItem("history", JSON.stringify(history));

  const newPoint = mintPoint + 1;
  localStorage.setItem("mintPoint", newPoint);
  setMintPoint(newPoint);

  // 表示メッセージも cm/g に合わせる
  setMessage(
    mode === "cm"
      ? `記録しました：${cm}cm → ${usedMl}mL（ミントポイント +1）\n${randomMessage}`
      : `記録しました：${gram}g → ${usedMl}mL（ミントポイント +1）\n${randomMessage}`
  );

  setCm("");
  setGram("");

  setTimeout(() => setMessage(""), 6000);
};
 



  // ★ 修正保存処理
  const saveEdit = () => {
    const history = JSON.parse(localStorage.getItem("history") || "[]");

    const usedMl = (cm * ML_PER_CM).toFixed(1);
    history[lastRecordIndex].cm = cm;
    history[lastRecordIndex].ml = usedMl;

    localStorage.setItem("history", JSON.stringify(history));

    setMessage("修正しました");
    setIsEditing(false);
    setCm("");

    setTimeout(() => setMessage(""), 6000);
  };

  if (!staff) return <p>スタッフ情報を読み込んでいます…</p>;

  return (
    <main
      style={{
        padding: "20px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif"
      }}
    >
      <h1 style={{ color: "#006b5f", marginBottom: "10px" }}>今日の記録</h1>

      {/* スタッフ情報カード */}
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
        <p style={{ marginTop: "10px", color: "#006b5f" }}>
          ミントポイント：{mintPoint} pt
        </p>
      </div>

  {/* cm / g 切り替えボタン */}
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

      {/* 入力欄（cm / g 切り替え） */}
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
        marginTop: "8px"
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
        marginTop: "8px"
        fontSize: "16px"  
      }}
    />
  )}
</div>


      {/* メッセージ */}
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

      {/* 修正ボタン（直前の記録がある時だけ表示） */}
      {lastRecordIndex !== null && !isEditing && (
        <button
          onClick={() => {
            const history = JSON.parse(localStorage.getItem("history") || "[]");
            const last = history[lastRecordIndex];

            setCm(last.cm);
            setMessage("直前の記録を修正できます");
            setIsEditing(true);
          }}
          style={{
            width: "100%",
            padding: "16px",
            background: "#e8f6f6",
            border: "1px solid #cfeeee",
            borderRadius: "12px",
            fontSize: "18px",
            color: "#006b5f",
            cursor: "pointer",
            marginBottom: "16px"
          }}
        >
          ✏️ 直前の記録を修正する
        </button>
      )}

      {/* 記録 or 修正ボタン */}
      {!isEditing ? (
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
      ) : (
        <button
          onClick={saveEdit}
          style={{
            width: "100%",
            padding: "16px",
            background: "#4BB5C1",
            border: "none",
            borderRadius: "12px",
            fontSize: "20px",
            color: "white",
            cursor: "pointer"
          }}
        >
          ✔ 修正を保存する
        </button>
      )}

      <NavBar />
    </main>
  );
}
