"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

// ★ Firestore
import { db } from "@/firebaseConfig";
import { setDoc, doc } from "firebase/firestore";

export default function AddStaff() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [wardId, setWardId] = useState("");
  const [workDays, setWorkDays] = useState("");
  const [wards, setWards] = useState([]);
  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    const savedWards = JSON.parse(localStorage.getItem("wards") || "[]");
    const savedStaff = JSON.parse(localStorage.getItem("staffList") || "[]");

    setWards(savedWards);
    setStaffList(savedStaff);
  }, []);

  const handleAdd = async () => {
    if (!name || !wardId || !workDays) {
      alert("スタッフ名・病棟・勤務日数を入力してください");
      return;
    }

    const newStaffId = Date.now(); // 職員番号として利用

    const staffData = {
      staffId: newStaffId,
      name,
      wardId: Number(wardId),
      workDays: `${workDays}日`,
      role: "staff",
      isActive: true, // ★ 在職者として登録
    };

    // ★ Firestore に登録
    await setDoc(doc(db, "staff", String(newStaffId)), staffData);

    // ★ localStorage にも登録（互換性維持）
    const updated = [...staffList, staffData];
    localStorage.setItem("staffList", JSON.stringify(updated));
    setStaffList(updated);

    alert("スタッフを追加しました！");
    setName("");
    setWardId("");
    setWorkDays("");
  };

  const deleteStaff = (staffId) => {
    const updated = staffList.filter((s) => s.staffId !== staffId);
    localStorage.setItem("staffList", JSON.stringify(updated));
    setStaffList(updated);
  };

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <BackButton to="/admin/settings/staff" />

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
        }}
      >
        👤 スタッフの追加
      </h1>

      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #cfeeee",
          marginBottom: "24px",
        }}
      >
        <label style={{ color: "#006b5f" }}>スタッフ名：</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        <label style={{ color: "#006b5f" }}>所属病棟：</label>
        <select
          value={wardId}
          onChange={(e) => setWardId(e.target.value)}
          style={inputStyle}
        >
          <option value="">選択してください</option>
          {wards.map((ward) => (
            <option key={ward.id} value={ward.id}>
              {ward.name}
            </option>
          ))}
        </select>

        <label style={{ color: "#006b5f" }}>勤務日数：</label>
        <input
          type="number"
          value={workDays}
          onChange={(e) => setWorkDays(e.target.value)}
          placeholder="例：20"
          style={inputStyle}
        />

        <button
          onClick={handleAdd}
          style={{
            background: "#006b5f",
            color: "white",
            padding: "12px 20px",
            borderRadius: "10px",
            border: "none",
            cursor: "pointer",
            width: "100%",
            fontSize: "16px",
          }}
        >
          追加する
        </button>
      </div>
    </main>
  );
}

const inputStyle = {
  display: "block",
  marginBottom: "12px",
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #cfeeee",
};
