"use client";

import { messages } from "../../data/messages";
import NavBar from "../../components/NavBar";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { db } from "../../firebaseConfig";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";

// ★ 病棟ID → 表示名マップ
const wardNameMap = {
  "6f": "6階",
  "5f": "5階",
  "4f": "4階",
  "78f": "7.8階",
  "gairai": "外来",
  "touseki": "透析室",
  "riha": "リハビリ",
  "ikyoku": "医局",
  "shisetsu": "施設管理",
};

export default function RecordPage() {
  const router = useRouter();
  const EMPTY_WEIGHT = 46;
  const FULL_WEIGHT = 260;
  // ★ g → mL 換算係数（263g = 250mL）
const ML_PER_GRAM = 250 / (263 - 46); // 250 / 217 = 1.152mL


  const randomMessage =
    messages[Math.floor(Math.random() * messages.length)];

  const [weightNow, setWeightNow] = useState("");
  const [message, setMessage] = useState("");
  const [staff, setStaff] = useState(null);

  const [showExchangeConfirm, setShowExchangeConfirm] = useState(false);

 useEffect(() => {
  const local = JSON.parse(localStorage.getItem("currentStaff"));

  if (!local) {
    router.replace("/login");
    return;
  }

  if (!local.lastWeight) {
    router.replace("/first-weight");
    return;
  }

  setStaff(local);
}, []); // ← ここは [] が正解

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
          unit: "weight",
          mintPoint: 1,
          weightNow: nowWeightValue,
          weightPrev: staff.lastWeight,
          date: Timestamp.now(),
        }),
      });
    } catch (error) {
      setMessage("クラウド保存に失敗しました");
      return false;
    }

    const history = JSON.parse(localStorage.getItem("history") || "[]");
    history.push({
      staffId: staff.staffId,
      name: staff.name,
      department: wardNameMap[staff.wardId] || staff.department,
      wardId: staff.wardId,
      ml: usedMl,
      unit: "weight",
      weightNow: nowWeightValue,
      weightPrev: staff.lastWeight,
      date: Timestamp.now(),
    });
    localStorage.setItem("history", JSON.stringify(history));

    setMessage(
      `記録しました：${nowWeightValue}g → ${usedMl}mL（ミントポイント +1）\n${randomMessage}`
    );

    setWeightNow("");
    setTimeout(() => setMessage(""), 6000);
    return true;
  };

  // ★ ボトル交換 YES（完全修正版）
const handleExchangeYes = async () => {
  let prev = Number(staff.lastWeight);

  // ★ lastWeight が壊れている人を自動初期化
  if (isNaN(prev) || prev < EMPTY_WEIGHT || prev > FULL_WEIGHT) {
    prev = FULL_WEIGHT;
  }

  const now = Number(weightNow);

  const prevRemainG = prev - EMPTY_WEIGHT;
  const nowRemainG = now - EMPTY_WEIGHT;

  let usedMl = (prevRemainG - nowRemainG) * ML_PER_GRAM;

  if (usedMl < 0) usedMl = 0;
  if (usedMl < 0.01) usedMl = 0;
  usedMl = Number(usedMl.toFixed(2));

 try {
  // ★ staff コレクション（既存）
  await updateDoc(doc(db, "staff", staff.staffId), {
    lastWeight: now,
  });

  // ★★★ staffs コレクション（クラウド復旧用）★★★
  await updateDoc(doc(db, "staffs", staff.staffId), {
    lastWeight: now,
  });

  // ★ localStorage 更新
  const updated = { ...staff, lastWeight: now };
  localStorage.setItem("currentStaff", JSON.stringify(updated));
  setStaff(updated);

} catch (e) {
  setMessage("前回の重さ更新に失敗しました");
  return;
}

// ★ 二重登録防止
await saveRecord(usedMl, now);
return;
    // ★ 必須（多重登録防止）
};

  // ★ ボトル交換 NO
  const handleExchangeNo = () => {
    setMessage("重さが増えています。正しい重さを入力してください。");
    setShowExchangeConfirm(false);
  };

  // ★ 記録処理（重さ方式）完全修正版
const handleRecord = async () => {
  if (!staff) return;

  if (!weightNow) {
    setMessage("重さを入力してください");
    return;
  }

  const now = Number(weightNow);
  let prev = Number(staff.lastWeight);

  // ★ lastWeight が壊れている人を自動初期化
  if (isNaN(prev) || prev < EMPTY_WEIGHT || prev > FULL_WEIGHT) {
    prev = FULL_WEIGHT; // 初期値は満タン扱い
  }

  // ★ ボトル交換判定（誤差3gまで許容）
  if (now > prev + 3) {
    setShowExchangeConfirm(true);
    return;
  }

  // ★ 使用量計算（異常値を自動補正）
  let usedMl = (prev - now) * ML_PER_GRAM;

  if (usedMl < 0) usedMl = 0;          // マイナス補正
  if (usedMl < 0.01) usedMl = 0;       // 極小値補正
  usedMl = Number(usedMl.toFixed(2));  // 小数点第2位に統一

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

  // ★ 二重登録防止（return を必ず入れる）
  await saveRecord(usedMl, now);
  return;
};


  if (!staff) {
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

        <div
          style={{
            background: "#ffffff",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "20px",
            border: "1px solid #cfeeee",
          }}
        >
          <label style={{ color: "#006b5f" }}>今日使った量（g）</label>

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
