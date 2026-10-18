"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { requestStaffWeightSettings } from "../utils/requestStaffWeightSettings";

export default function ModeChangePage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);

  const [newMode, setNewMode] = useState(null);
  const [weight, setWeight] = useState("");
  const [message, setMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

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

  const saveMode = async (mode) => {
    if (submittingRef.current) return;
    if (mode === "weight" && !weight) { setMessage("現在の重さを入力してください"); return; }
    submittingRef.current = true;
    setIsSubmitting(true);
    setMessage("");
    let committed = false;
    let navigating = false;
    try {
      const saved = await requestStaffWeightSettings("/api/staff/change-mode", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: staff.staffId, mode, ...(mode === "weight" ? { weight } : {}) }),
      });
      committed = true;
      const updated = { ...staff, ...saved };
      localStorage.setItem("currentStaff", JSON.stringify(updated));
      setStaff(updated);
      setMessage(mode === "cm" ? "cm方式に切り替えました" : "重さ方式に切り替えました");
      setTimeout(() => router.replace("/record"), 1500);
      navigating = true;
    } catch (error) {
      setMessage(committed
        ? "設定は保存されましたが、端末内の処理に失敗しました。再登録せず、管理者に確認してください。"
        : error.message || "保存結果を確認できませんでした。再登録せず、管理者に確認してください。");
    } finally {
      if (!navigating) {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };
  const handleSwitchToCm = () => saveMode("cm");
  const handleRegisterWeight = () => saveMode("weight");

  return (
    <div style={{ padding: "20px", maxWidth: "480px", margin: "0 auto" }}>
      <h1 style={{ color: "#006b5f" }}>記録方式の変更</h1>

      <p>現在の方式：{staff.mode === "cm" ? "cm方式" : "重さ方式（g）"}</p>

      {/* ★ cm → 重さ */}
      {staff.mode === "cm" && (
        <>
          <button
            onClick={handleSwitchToWeight}
            disabled={isSubmitting}
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
                disabled={isSubmitting}
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
          disabled={isSubmitting}
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
