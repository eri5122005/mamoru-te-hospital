"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditRecord() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id"); // ← Firestore の document ID

  const [record, setRecord] = useState(null);
  const [raw, setRaw] = useState("");

  const ML_PER_CM = 23.8;

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
      setRaw(data.amount); // ← cm or g の元の値
    };

    load();
  }, [id]);

  const saveEdit = async () => {
    if (!record) return;

    let newMl = 0;

    if (record.unit === "cm") {
      newMl = Number((raw * ML_PER_CM).toFixed(1));
    } else {
      newMl = Number((raw / 0.864).toFixed(1));
    }

    await updateDoc(doc(db, "records", id), {
      amount: Number(raw),
      ml: newMl,
      updatedAt: new Date(),
    });

    router.push("/history");
  };

  if (!record) return <p>読み込み中…</p>;

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
      <h1 style={{ color: "#006b5f", marginBottom: "24px", textAlign: "center" }}>
        ✏️ 記録の修正
      </h1>

      <p style={{ marginBottom: "12px", color: "#006b5f" }}>
        日付：{record.date.toDate().toLocaleString()}
      </p>

      <p style={{ marginBottom: "12px", color: "#006b5f" }}>
        入力モード：{record.unit === "cm" ? "cm" : "g"}
      </p>

      <input
        type="number"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #cfeeee",
          marginBottom: "20px",
        }}
      />

      <button
        onClick={saveEdit}
        style={{
          background: "#4BB5C1",
          color: "white",
          padding: "14px 20px",
          borderRadius: "12px",
          border: "none",
          fontSize: "18px",
          cursor: "pointer",
          width: "100%",
        }}
      >
        修正を保存する
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
