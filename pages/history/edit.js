"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditRecord() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");

  const [record, setRecord] = useState(null);
  const [ml, setMl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const snap = await getDoc(doc(db, "records", id));

      if (!snap.exists()) {
        alert("記録が見つかりません");
        router.push("/history");
        return;
      }

      const data = snap.data();

      setRecord(data);

      // 現在保存されている「使用量」をそのまま表示
      setMl(String(data.ml ?? ""));
    };

    load();
  }, [id, router]);

  const saveEdit = async () => {
    if (!record || isSaving) return;

    const newMl = Number(ml);

    if (!Number.isFinite(newMl)) {
      alert("使用量を数字で入力してください");
      return;
    }

    if (newMl < 0) {
      alert("使用量は0mL以上で入力してください");
      return;
    }

    const ok = confirm(
      `使用量を ${newMl.toFixed(2)} mL に修正してよろしいですか？`
    );

    if (!ok) return;

    setIsSaving(true);

    try {
      await updateDoc(doc(db, "records", id), {
        ml: Number(newMl.toFixed(2)),
        updatedAt: new Date(),
      });

      router.push("/history");
    } catch (error) {
      console.error("記録修正エラー:", error);
      alert("記録の修正に失敗しました");
      setIsSaving(false);
    }
  };

  if (!record) {
    return <p>読み込み中…</p>;
  }

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        ✏️ 記録の修正
      </h1>

      <p
        style={{
          marginBottom: "12px",
          color: "#006b5f",
        }}
      >
        日付：{record.date.toDate().toLocaleString()}
      </p>

      <p
        style={{
          marginBottom: "8px",
          color: "#006b5f",
        }}
      >
        使用量（mL）
      </p>

      <input
        type="number"
        step="0.01"
        min="0"
        value={ml}
        onChange={(e) => setMl(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #cfeeee",
          marginBottom: "20px",
          fontSize: "18px",
        }}
      />

      <button
        onClick={saveEdit}
        disabled={isSaving}
        style={{
          background: "#4BB5C1",
          color: "white",
          padding: "14px 20px",
          borderRadius: "12px",
          border: "none",
          fontSize: "18px",
          cursor: isSaving ? "not-allowed" : "pointer",
          width: "100%",
          opacity: isSaving ? 0.6 : 1,
        }}
      >
        {isSaving ? "保存中…" : "修正を保存する"}
      </button>

      <div
        onClick={() => router.push("/history")}
        style={{
          marginTop: "24px",
          textAlign: "center",
          color: "#006b5f",
          cursor: "pointer",
        }}
      >
        ← 履歴に戻る
      </div>
    </main>
  );
}