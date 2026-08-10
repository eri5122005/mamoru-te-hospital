"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AddStaff() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [wardId, setWardId] = useState("");
  const [wards, setWards] = useState([]);

  // 病棟一覧を読み込む
  useEffect(() => {
    const savedWards = JSON.parse(localStorage.getItem("wards") || "[]");
    setWards(savedWards);
  }, []);

  const handleAdd = () => {
    if (!name || !wardId) {
      alert("スタッフ名と病棟を選択してください");
      return;
    }

    const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");

    staffList.push({
      staffId: Date.now(),
      name,
      wardId: Number(wardId),   // ★ wardId を保存（ズレゼロ）
    });

    localStorage.setItem("staffList", JSON.stringify(staffList));

    alert("スタッフを追加しました！");
    setName("");
    setWardId("");
  };

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>スタッフの追加</h1>

      <div style={{ background: "white", padding: "20px", borderRadius: "12px" }}>
        {/* スタッフ名 */}
        <label>スタッフ名：</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", marginBottom: "12px", width: "100%" }}
        />

        {/* 病棟選択（wardId） */}
        <label>所属病棟：</label>
        <select
          value={wardId}
          onChange={(e) => setWardId(e.target.value)}
          style={{ display: "block", marginBottom: "12px", width: "100%" }}
        >
          <option value="">選択してください</option>
          {wards.map((ward) => (
            <option key={ward.id} value={ward.id}>
              {ward.name}
            </option>
          ))}
        </select>

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
          cursor: "pointer",
        }}
      >
        ← 設定ページへ戻る
      </button>
    </main>
  );
}
