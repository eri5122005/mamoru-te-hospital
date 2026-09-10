"use client";

import { messages } from "../../data/messages";
import NavBar from "../../components/NavBar";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { db } from "../../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
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
};

export default function RecordPage() {
  const router = useRouter();
  const EMPTY_WEIGHT = 46; // 空ボトルの重さ
  const FULL_WEIGHT = 260; // 新品ボトルの重さ（固定）

  const randomMessage =
    messages[Math.floor(Math.random() * messages.length)];

  const [weightNow, setWeightNow] = useState("");
  const [message, setMessage] = useState("");
  const [staff, setStaff] = useState(null);

  // ★ ボトル交換確認ダイアログ
  const [showExchangeConfirm, setShowExchangeConfirm] = useState(false);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("currentStaff"));
    if (!data) {
      router.replace("/login");
      return;
    }
    setStaff(data);
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

    // ★ ローカル履歴保存
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

    // ★ メッセージ
    setMessage(
      `記録しました：${nowWeightValue}g → ${usedMl}mL（ミントポイント +1）\n${randomMessage}`
    );

    setWeightNow("");
    setTimeout(() => setMessage(""), 6000);
    return true;
  };

  // ★ ボトル交換 YES（完全修正版）
  const handleExchangeYes = async () => {
    const prev = staff.lastWeight; // 前回の重さ
    const now = Number(weightNow); // 今回の重さ

    const prevRemain = prev - EMPTY_WEIGHT; // 前回残量
    const nowRemain = now - EMPTY_WEIGHT; // 今回残量

    // ★ ボトル交換時の使用量（前回残量 + 今回使用量）
    const usedMl = prevRemain + (FULL_WEIGHT - nowRemain);

    // ★ lastWeight を更新（新品ボトルの重さ）
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

  // ★ 記録処理（重さ方式のみ）
  const handleRecord = async () => {
    if (!staff) return;

    if (!weightNow) {
      setMessage("重さを入力してください");
      return;
    }

    const prev = staff.lastWeight;
    const now = Number(weightNow);

    // ★ 重さが増えている → ボトル交換の可能性
    if (now > prev) {
      setShowExchangeConfirm(true);
      return;
    }

    // ★ 通常計算
    const usedMl = prev - now;

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

        {/* ★ 入力欄（重さのみ） */}
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
