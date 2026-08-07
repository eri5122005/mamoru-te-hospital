"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function EditRecord() {
  const router = useRouter();
  const params = useSearchParams();
  const index = Number(params.get("index"));

  const [record, setRecord] = useState(null);
  const [ml, setMl] = useState("");

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("history") || "[]");
    const target = history[index];

    setRecord(target);
    setMl(target.ml);
  }, [index]);

  const saveEdit = () => {
    const history = JSON.parse(localStorage.getItem("history") || "[]");

    history[index].ml = ml; // ← 修正するのはここだけ

    localStorage.setItem("history", JSON.stringify(history));

    router.push("/history");
  };

  if (!record) return <p>読み込み中…</p>;

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "24px", textAlign: "center" }}>
        ✏️ 記録の修正
      </h1>

      <p style={{ marginBottom: "12px", color: "#006b5f" }}>
        日付：{record.date}
      </p>
      <p style={{ marginBottom: "12px", color: "#006b5f" }}>
        部署：{record.department}
      </p>

      <input
        type="number"
        value={ml}
        onChange={(e) => setMl(e.target.value)}
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
