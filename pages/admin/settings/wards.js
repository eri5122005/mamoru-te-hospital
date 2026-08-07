"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";   // ★追加：戻るボタンに必要

export default function AddWard() {
  const router = useRouter();                  // ★追加：戻るボタンに必要

  const [name, setName] = useState("");
  const [id, setId] = useState("");

  const handleAdd = () => {
    if (!name || !id) {
      alert("病棟名とIDを入力してください");
      return;
    }

    const wards = JSON.parse(localStorage.getItem("wards") || "[]");

    wards.push({
      id: Number(id),
      name: name,
    });

    localStorage.setItem("wards", JSON.stringify(wards));

    alert("病棟を追加しました！");
    setName("");
    setId("");
  };

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>病棟の追加</h1>

      <div style={{ background: "white", padding: "20px", borderRadius: "12px" }}>
        <label>病棟名：</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", marginBottom: "12px", width: "100%" }}
        />

        <label>病棟ID：</label>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          style={{ display: "block", marginBottom: "12px", width: "100%" }}
        />

        <button
          onClick={handleAdd}
          style={{
            background: "#006b5f",
            color: "white",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
          }}
        >
          追加する
        </button>
      </div>

      {/* ★ここが戻るボタン（設定ページへ戻る） */}
      <button
        onClick={() => router.push("/admin/settings")}
        style={{
          marginTop: "24px",
          padding: "12px",
          width: "100%",
          background: "#e8f6f6",
          borderRadius: "8px",
          border: "none",
          color: "#006b5f",
          cursor: "pointer"
        }}
      >
        ← 設定ページへ戻る
      </button>
    </main>
  );
}
