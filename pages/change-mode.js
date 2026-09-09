"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { db } from "../firebaseConfig";

import { doc, updateDoc } from "firebase/firestore";

export default function ModeChangePage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);

  const [newMode, setNewMode] = useState(null);
  const [weight, setWeight] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("currentStaff"));
    if (!data) {
      router.replace("/login");
      return;
    }
    setStaff(data);
  }, []);

  if (!staff) return <p>読み込み中…</p>;

  // ★ cm → 重さに切り替える処理
  const handleSwitchToWeight = () => {
    setNewMode("weight");
  };

  // ★ 重さ → cm に切り替える処理
  const handleSwitchToCm = async () => {
    try {
      await updateDoc(doc(db, "staff", staff.staffId), {
        mode: "cm",
      });

      const updated = { ...staff, mode: "cm" };
      localStorage.setItem("currentStaff", JSON.stringify(updated));
      setStaff(updated);

      setMessage("cm方式に切り替えました");
      setTimeout(() => router.replace("/record"), 1500);
    } catch (e) {
      setMessage("切り替えに失敗しました");
    }
  };

  // ★ 重さ方式へ切り替える（重さ登録必須）
  const handleRegisterWeight = async () => {
    if (!weight) {
      setMessage("現在の重さを入力してください");
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
      setStaff(updated);

      setMessage("重さ方式に切り替えました");
      setTimeout(() => router.replace("/record"), 1500);
    } catch (e) {
      setMessage("重さの登録に失敗しました");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "480px", margin: "0 auto" }}>
      <h1 style={{ color: "#006b5f" }}>記録方式の変更</h1>

      <p>現在の方式：{staff.mode === "cm" ? "cm方式" : "重さ方式（g）"}</p>

      {/* ★ cm → 重さ */}
      {staff.mode === "cm" && (
        <>
          <button
            onClick={handleSwitchToWeight}
            style={{
              width: "100%",
              padding: "14px",
              background: "#cfeeee",
              borderRadius: "12px",
              border: "none",
              marginTop: "20px",
              color: "#006b5f",
            }}
          >
            重さ方式に切り替える（g）
          </button>

          {newMode === "weight" && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #cfeeee",
              }}
            >
              <p style={{ color: "#006b5f" }}>
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
                  marginTop: "8px",
                }}
              />

              <button
                onClick={handleRegisterWeight}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "#2AAE9E",
                  borderRadius: "12px",
                  border: "none",
                  marginTop: "16px",
                  color: "white",
                }}
              >
                重さ方式に切り替える
              </button>
            </div>
          )}
        </>
      )}

      {/* ★ 重さ → cm */}
      {staff.mode === "weight" && (
        <button
          onClick={handleSwitchToCm}
          style={{
            width: "100%",
            padding: "14px",
            background: "#e8f6f6",
            borderRadius: "12px",
            border: "none",
            marginTop: "20px",
            color: "#006b5f",
          }}
        >
          cm方式に切り替える
        </button>
      )}

      {message && (
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            background: "#dffef5",
            borderRadius: "12px",
            color: "#008b75",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
