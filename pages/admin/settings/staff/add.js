"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddStaff() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");

  const handleAdd = () => {
    if (!name || !department) {
      alert("スタッフ名と部署を入力してください");
      return;
    }

    const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");

    staffList.push({
      staffId: Date.now(),
      name,
      department
    });

    localStorage.setItem("staffList", JSON.stringify(staffList));

    alert("スタッフを追加しました！");
    setName("");
    setDepartment("");
  };

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>スタッフの追加</h1>

      <div style={{ background: "white", padding: "20px", borderRadius: "12px" }}>
        <label>スタッフ名：</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ display: "block", marginBottom: "12px", width: "100%" }}
        />

        <label>部署名：</label>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
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
