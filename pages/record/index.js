"use client";

import { messages } from "../../data/messages";
import NavBar from "../../components/NavBar";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { db } from "../../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";


// ★ 病棟ID → 表示名マップ（最新）
const wardNameMap = {
  "6f": "6階",
  "5f": "5階",
  "4f": "4階",
  "78f": "7.8階",
  "gairai": "外来",
  "touseki": "透析室",
  "riha": "リハビリ",
  "ikyoku": "医局",
};

export default function RecordPage() {
  const router = useRouter();
  const ML_PER_CM = 23.8;
  const EMPTY_WEIGHT = 46; // ★ 空ボトルの重さ（g）

  const randomMessage =
    messages[Math.floor(Math.random() * messages.length)];

  const [cm, setCm] = useState("");
  const [weightNow, setWeightNow] = useState("");
  const [message, setMessage] = useState("");
  const [staff, setStaff] = useState(null);

  const [mode, setMode] = useState(null);

  // ★ ボトル交換確認ダイアログ
  const [showExchangeConfirm, setShowExchangeConfirm] = useState(false);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("currentStaff"));
    if (!data) {
      router.replace("/login");
      return;
    }

    setStaff(data);
    setMode(data.mode);
  }, [router]);

  // ★ 記録保存共通処理
  const saveRecord = async (usedMl, nowWeightValue) => {
    try {
      await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: staff.staffId,
          name: staff.name,
          department: wardNameMap[staff.wardId] || staff.department,
          wardId: staff.wardId,
          ml: usedMl,
          unit: mode,
          mintPoint: 1,
          weightNow: mode === "weight" ? nowWeightValue : null,
          weightPrev: mode === "weight" ? staff.lastWeight : null,
          date: Timestamp.now(),   // ★ ここだけでOK
        }),
      });
    } catch (error) {
      setMessage("クラウド保存に失敗しました");
      return false;
    }

    // ★ ローカル履歴保存
    const history = JSON.parse(localStorage.getItem("history") || "[]");
    history.push({
      staffId: staff.staffId,
      name: staff.name,
      department: wardNameMap[staff.wardId] || staff.department,
      wardId: staff.wardId,
      ml: usedMl,
      unit: mode,
      weightNow: mode === "weight" ? nowWeightValue : null,
      weightPrev: mode === "weight" ? staff.lastWeight : null,
    

date: Timestamp.now(),

    });
    localStorage.setItem("history", JSON.stringify(history));

    // ★ メッセージ
    setMessage(
      mode === "cm"
        ? `記録しました：${cm}cm → ${usedMl}mL（ミントポイント +1）\n${randomMessage}`
        : `記録しました：${nowWeightValue}g → ${usedMl}mL（ミントポイント +1）\n${randomMessage}`
    );

    setCm("");
    setWeightNow("");

    setTimeout(() => setMessage(""), 6000);

    return true;
  };

  // ★ ボトル交換 YES
  const handleExchangeYes = async () => {
    const prev = staff.lastWeight;
    const now = Number(weightNow);

    const prevRemain = prev - EMPTY_WEIGHT;
    const nowRemain = now - EMPTY_WEIGHT;

    // ★ ボトル交換時の使用量
    const usedMl = prevRemain + (prev - now);

    // ★ lastWeight を更新（新しいボトルの重さ）
    await updateDoc(doc(db, "staff", staff.staffId), {
      lastWeight: now,
    });

    const updated = { ...staff, lastWeight: now };
    localStorage.setItem("currentStaff", JSON.stringify(updated));
    setStaff(updated);

    await saveRecord(usedMl, now);

    setShowExchangeConfirm(false);
  };

  // ★ ボトル交換 NO
  const handleExchangeNo = () => {
    setMessage("重さが増えています。正しい重さを入力してください。");
    setShowExchangeConfirm(false);
  };

  // ★ 記録処理
  const handleRecord = async () => {
    if (!staff) return;

    if (mode === "cm" && !cm) {
      setMessage("cmを入力してください");
      return;
    }
    if (mode === "weight" && !weightNow) {
      setMessage("重さを入力してください");
      return;
    }

    let usedMl = 0;

    // ★ cm方式
    if (mode === "cm") {
      usedMl = Number((cm * ML_PER_CM).toFixed(1));
      await saveRecord(usedMl, null);
      return;
    }

    // ★ 重さ方式
    if (mode === "weight") {
      const prev = staff.lastWeight;
      const now = Number(weightNow);

      // ★ 重さが増えている → ボトル交換の可能性
      if (now > prev) {
        setShowExchangeConfirm(true);
        return;
      }

      // ★ 通常計算
      usedMl = prev - now;

      // ★ lastWeight 更新
      try {
        await updateDoc(doc(db, "staff", staff.staffId), {
          lastWeight: now,
        });

        const updated = { ...staff, lastWeight: now };
        localStorage.setItem("currentStaff", JSON.stringify(updated));
        setStaff(updated);
      } catch (e) {
        setMessage("前回の重さ更新に失敗しました");
        return;
      }

      await saveRecord(usedMl, now);
    }
  };

  if (!staff || mode === null) {
    return <p>スタッフ情報を読み込んでいます…</p>;
  }

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

        {/* ★ ボトル交換ダイアログ */}
        {showExchangeConfirm && (
          <div
            style={{
              background: "#fff3cd",
              padding: "16px",
              borderRadius: "12px",
              marginBottom: "20px",
              border: "1px solid #ffeeba",
              textAlign: "center",
            }}
          >
            <p style={{ marginBottom: "12px", fontWeight: "bold" }}>
              重さが前回より増えています。ボトル交換しましたか？
            </p>
            <button
              onClick={handleExchangeYes}
              style={{
                background: "#2AAE9E",
                color: "white",
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                marginRight: "10px",
              }}
            >
              はい
            </button>
            <button
              onClick={handleExchangeNo}
              style={{
                background: "#ccc",
                color: "#333",
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
              }}
            >
              いいえ
            </button>
          </div>
        )}

        {/* ★ 記録方式の案内 */}
        <div
          style={{
            background: "#dffef5",
            color: "#008b75",
            padding: "12px",
            borderRadius: "12px",
            marginBottom: "16px",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          あなたの記録方式：{mode === "cm" ? "cm方式" : "重さ方式（g）"}
        </div>

        {/* ★ スタッフ情報 */}
        <div
          style={{
            background: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            border: "1px solid #cfeeee",
          }}
        >
          <p>職員番号：{staff.staffId}</p>
          <p>名前：{staff.name}</p>
          <p>病棟：{wardNameMap[staff.wardId] || staff.department}</p>
        </div>

        {/* ★ 入力方式タブ */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          {mode === "cm" && (
            <button
              onClick={() => setMode("cm")}
              style={{
                background: "#cfeeee",
                color: "#006b5f",
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                flex: 1,
              }}
            >
              cm入力
            </button>
          )}

          {mode === "weight" && (
            <button
              onClick={() => setMode("weight")}
              style={{
                background: "#cfeeee",
                color: "#006b5f",
                padding: "10px 16px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                flex: 1,
              }}
            >
              重さ入力（g）
            </button>
          )}
        </div>

        {/* ★ 入力欄 */}
        <div
          style={{
            background: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            border: "1px solid #cfeeee",
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
                fontSize: "16px",
              }}
            />
          ) : (
            <input
              type="number"
              value={weightNow}
              onChange={(e) => setWeightNow(e.target.value)}
              placeholder="例：240（g）"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #cfeeee",
                marginTop: "8px",
                fontSize: "16px",
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
              boxShadow: "0 0 8px rgba(0, 150, 130, 0.15)",
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
            cursor: "pointer",
          }}
        >
          ＋ 記録する
        </button>

        <NavBar />
      </main>
    </div>
  );
}
