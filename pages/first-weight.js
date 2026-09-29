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
  "shisetsu": "施設管理",
};

export default function FirstWeightPage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);

  const [selectedMode, setSelectedMode] = useState(false);
  const [weight, setWeight] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("currentStaff"));
    if (!data) {
      router.replace("/login");
      return;
    }

    if (data.lastWeight) {
      router.replace("/record");
      return;
    }

    setStaff(data);
  }, [router]);

  const handleSelectWeight = () => {
    setSelectedMode(true);
  };

  // ★ 重さ方式の初回重さ登録（完成版）
  const handleRegisterWeight = async () => {
    if (!weight) {
      setMessage("重さを入力してください");
      return;
    }

    const now = Number(weight);

    try {
      // ★ staff コレクション（既存）
      await updateDoc(doc(db, "staff", staff.staffId), {
        mode: "weight",
        lastWeight: now,
        emptyWeight: 46,
      });

      // ★ staffs コレクション（クラウド復旧用）
      await updateDoc(doc(db, "staffs", staff.staffId), {
        lastWeight: now,
        emptyWeight: 46,
        mode: "weight",
      });

     // ★ localStorage 更新
const updated = {
  ...staff,
  mode: "weight",
  lastWeight: now,
  emptyWeight: 46,
};

localStorage.setItem("currentStaff", JSON.stringify(updated));
localStorage.setItem(`staff-${staff.staffId}`, JSON.stringify(updated)); // ★ これが必要
 

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

        {!selectedMode && (
          <>
            <p style={{ color: "#006b5f", marginBottom: "12px" }}>
              初回のボトル重さを登録してください
            </p>

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
              初回のボトル重さを登録する（g）
            </button>
          </>
        )}

        {selectedMode && (
          <>
            <p
              style={{
                color: "#006b5f",
                marginBottom: "8px",
                marginTop: "20px",
              }}
            >
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
