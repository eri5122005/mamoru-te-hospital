"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { db } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

// ★ 病棟ID → 表示名マップ
const wardNameMap = {
  "4f": "4階",
  "5f": "5階",
  "6f": "6階",
  "78f": "7.8階",
  "gairai": "外来",
  "touseki": "透析室",
  "riha": "リハビリ",
  "ikyoku": "医局",
};

export default function FirstWeightPage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);

  // ★ 記録方式選択
  const [selectedMode, setSelectedMode] = useState(null);

  // ★ 重さ入力
  const [weight, setWeight] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("currentStaff"));
    if (!data) {
      router.replace("/login");
      return;
    }

    // すでに lastWeight がある → 初回設定不要
    if (data.lastWeight) {
      router.replace("/record");
      return;
    }

    setStaff(data);
  }, [router]);

  // ★ cm方式を選んだ場合
  const handleSelectCm = async () => {
    try {
       setSelectedMode("cm");   // ★ これが必要
        const updated = { ...staff, mode: "cm" };

      // Firestore 更新
      await updateDoc(doc(db, "staff", staff.staffId), {
        mode: "cm",
      });

      // localStorage 更新
      localStorage.setItem("currentStaff", JSON.stringify(updated));

      router.replace("/record");
    } catch (e) {
      setMessage("cm方式の設定に失敗しました");
    }
  };

  // ★ 重さ方式を選んだ場合 → 重さ入力画面へ
  const handleSelectWeight = () => {
    setSelectedMode("weight");
  };

  // ★ 重さ方式の初回重さ登録
  const handleRegisterWeight = async () => {
    if (!weight) {
      setMessage("重さを入力してください");
      return;
    }

    const now = Number(weight);

    try {
      await updateDoc(doc(db, "staff", staff.staffId), {
        mode: "weight",
        lastWeight: now,
        emptyWeight: 46,
      });

      const updated = {
        ...staff,
        mode: "weight",
        lastWeight: now,
        emptyWeight: 46,
      };

      localStorage.setItem("currentStaff", JSON.stringify(updated));

      router.replace("/record");
    } catch (e) {
      setMessage("初期重さの登録に失敗しました");
    }
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
        <h1 style={{ color: "#006b5f", marginBottom: "10px" }}>
          初回設定
        </h1>

        {/* スタッフ情報 */}
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
          <p>病棟：{wardNameMap[staff.wardId] || staff.wardId}</p>
        </div>

        {/* ★ 記録方式選択画面 */}
        {!selectedMode && (
          <>
            <p style={{ color: "#006b5f", marginBottom: "12px" }}>
              記録方式を選んでください
            </p>

            <button
              onClick={handleSelectCm}
              style={{
                width: "100%",
                padding: "14px",
                background: "#e8f6f6",
                border: "none",
                borderRadius: "12px",
                fontSize: "18px",
                color: "#006b5f",
                cursor: "pointer",
                marginBottom: "12px",
              }}
            >
              cm方式で記録する
            </button>

            <button
              onClick={handleSelectWeight}
              style={{
                width: "100%",
                padding: "14px",
                background: "#cfeeee",
                border: "none",
                borderRadius: "12px",
                fontSize: "18px",
                color: "#006b5f",
                cursor: "pointer",
              }}
            >
              重さ方式で記録する（g）
            </button>
          </>
        )}

        {/* ★ 重さ方式を選んだ後の入力画面 */}
        {selectedMode === "weight" && (
          <>
            <p style={{ color: "#006b5f", marginBottom: "8px", marginTop: "20px" }}>
              現在のボトルの重さ（g）を入力してください
            </p>

            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="例：240（g）"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #cfeeee",
                marginBottom: "20px",
                fontSize: "16px",
              }}
            />

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
                }}
              >
                {message}
              </div>
            )}

            <button
              onClick={handleRegisterWeight}
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
              登録する
            </button>
          </>
        )}
      </main>
    </div>
  );
}
