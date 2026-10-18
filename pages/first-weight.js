"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { normalizeStaffId } from "../utils/normalizeStaffId";
import { requestStaffWeightSettings } from "../utils/requestStaffWeightSettings";

const wardNameMap = {
    "nursing": "看護部",
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = JSON.parse(localStorage.getItem("currentStaff"));
        if (!data) { router.replace("/login"); return; }
        const id = normalizeStaffId(data.staffId);
        const latest = await requestStaffWeightSettings(`/api/staff/first-weight?staffId=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (cancelled) return;
        const current = {
          ...data, ...latest,
          mode: latest.mode ?? null,
          lastWeight: latest.lastWeight ?? null,
          emptyWeight: latest.emptyWeight ?? null,
        };
        const alreadyRegistered = current.mode === "weight" &&
          current.lastWeight !== null && current.lastWeight !== undefined &&
          current.emptyWeight !== null && current.emptyWeight !== undefined;
        if (alreadyRegistered) {
          localStorage.setItem("currentStaff", JSON.stringify(current));
          localStorage.setItem(`staff-${current.staffId}`, JSON.stringify(current));
          router.replace("/record");
          return;
        }
        setStaff(current);
      } catch (error) {
        if (!cancelled) setMessage(error.message || "職員情報を確認できませんでした。管理者に確認してください。");
      }
    };
    load();
    return () => { cancelled = true; };
  }, [router]);

  const handleSelectWeight = () => {
    setSelectedMode(true);
  };

  const handleRegisterWeight = async () => {
    if (!staff || submittingRef.current) return;
    if (!weight) { setMessage("重さを入力してください"); return; }
    submittingRef.current = true;
    setIsSubmitting(true);
    setMessage("");
    let committed = false;
    try {
      const saved = await requestStaffWeightSettings("/api/staff/first-weight", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: staff.staffId, weight }),
      });
      committed = true;
      const updated = { ...staff, ...saved };
      localStorage.setItem("currentStaff", JSON.stringify(updated));
      localStorage.setItem(`staff-${saved.staffId}`, JSON.stringify(updated));
      setStaff(updated);
      router.replace("/record");
    } catch (error) {
      setMessage(committed
        ? "重量は保存されましたが、端末内の処理に失敗しました。再登録せず、管理者に確認してください。"
        : error.message || "保存結果を確認できませんでした。再登録せず、管理者に確認してください。");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!staff) return (
    <div style={{ padding: "16px" }}>
      <p role="alert">{message || "スタッフ情報を確認しています…"}</p>
      {message && <button onClick={() => router.replace("/login")}>ログイン画面へ戻る</button>}
    </div>
  );

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
        <h1 style={{ color: "#006b5f", marginBottom: "10px" }}>初回設定</h1>

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
              disabled={isSubmitting}
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
