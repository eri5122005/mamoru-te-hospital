"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "@/components/AdminLayout";

export default function StaffAddPage() {
  const router = useRouter();

  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [wardId, setWardId] = useState("");

  const handleSubmit = async () => {
    if (!staffId || !name || !wardId) {
      alert("全て入力してください");
      return;
    }

    try {
      const res = await fetch("/api/admin/staff-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, name, wardId }),
      });

      if (!res.ok) {
        alert("登録に失敗しました");
        return;
      }

      alert("スタッフを登録しました！");
      router.push("/admin/staff-list");
    } catch (error) {
      alert("通信エラーが発生しました");
    }
  };

  const cardStyle = {
    background: "#e8f6f6",
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
    border: "2px solid #aeece4",
  };

  const labelStyle = {
    color: "#00a68c",
    fontWeight: "bold",
    marginBottom: "8px",
    display: "block",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #aeece4",
    marginBottom: "16px",
  };

  const buttonStyle = {
    background: "#00a68c",
    color: "white",
    padding: "12px 20px",
    borderRadius: "10px",
    border: "none",
    width: "100%",
    fontSize: "16px",
  };

  return (
    <AdminLayout>
      <h1
        style={{
          color: "#00a68c",
          marginBottom: "24px",
          textAlign: "center",
        }}
      >
        スタッフ登録（クラウド版）
      </h1>

      <div style={cardStyle}>
        <label style={labelStyle}>スタッフID</label>
        <input
          style={inputStyle}
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
        />

        <label style={labelStyle}>名前</label>
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label style={labelStyle}>病棟ID</label>
        <input
          style={inputStyle}
          value={wardId}
          onChange={(e) => setWardId(e.target.value)}
        />

        <button style={buttonStyle} onClick={handleSubmit}>
          登録する
        </button>
      </div>
    </AdminLayout>
  );
}
