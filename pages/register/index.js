"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function RegisterPage() {
  const router = useRouter();

  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [workDays, setWorkDays] = useState("");

  useEffect(() => {
    // ログイン時の情報を読み込む
    const loginUser = JSON.parse(localStorage.getItem("loginUser") || "null");

    if (loginUser) {
      setStaffId(loginUser.staffId);
      setName(loginUser.name);
      setDepartment(loginUser.department);
    }
  }, []);

  // ★ スタッフ保存処理
  const saveStaff = () => {
    const newStaff = {
      staffId,
      name,
      department,
      workDays: Number(workDays),
    };

    const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");
    staffList.push(newStaff);
    localStorage.setItem("staffList", JSON.stringify(staffList));

    alert("スタッフを登録しました");
  };

  const handleRegister = () => {
    if (!name || !department || !workDays) {
      alert("名前・病棟・勤務日数を入力してください");
      return;
    }

    // ★ スタッフ一覧に保存
    saveStaff();

    // ★ currentStaff にも保存（ログイン中の人）
    const staffData = {
      staffId,
      name,
      department,
      workDays: Number(workDays),
    };
    localStorage.setItem("currentStaff", JSON.stringify(staffData));

    router.push("/home"); // ← ホームへ進む
  };

  return (
    <main style={{ padding: "20px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
        初回登録
      </h1>

      {/* ★ ログイン画面に戻るボタン（正しい位置） */}
      <div
        onClick={() => router.push("/login")}
        style={{
          marginBottom: "20px",
          background: "#e8f6f6",
          color: "#006b5f",
          padding: "12px",
          borderRadius: "10px",
          textAlign: "center",
          cursor: "pointer",
          fontSize: "16px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}
      >
        ← ログイン画面に戻る
      </div>

      {/* 職員番号 */}
      <div style={{ marginBottom: "20px" }}>
        <label>職員番号（自動）</label>
        <input
          type="text"
          value={staffId}
          readOnly
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid #cfeeee",
            background: "#e8fdf9"
          }}
        />
      </div>

      {/* 名前 */}
      <div style={{ marginBottom: "20px" }}>
        <label>名前</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：Yamada"
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid #cfeeee"
          }}
        />
      </div>

      {/* 病棟 */}
      <div style={{ marginBottom: "20px" }}>
        <label>病棟</label>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "12px",
            border: "1px solid #cfeeee"
          }}
        >
          <option value="">選択してください</option>
          <option value="4階病棟">4階病棟</option>
          <option value="5階病棟">5階病棟</option>
          <option value="6階病棟">6階病棟</option>
          <option value="7・8階病棟">7・8階病棟</option>
          <option value="外来">外来</option>
          <option value="リハビリ">リハビリ</option>
          <option value="医局">医局</option>
        </select>
      </div>

      {/* 勤務日数 */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "6px" }}>
          勤務日数（日勤換算）
        </label>
        <input
          type="number"
          step="0.5"
          value={workDays}
          onChange={(e) => setWorkDays(e.target.value)}
          placeholder="例：20"
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #cfeeee",
          }}
        />
        <p style={{ fontSize: "12px", color: "#006b5f", marginTop: "4px" }}>
          夜勤は1回＝2日、半日は0.5日、時短は1日として入力
        </p>
      </div>

      <button
        onClick={handleRegister}
        style={{
          width: "100%",
          padding: "14px",
          background: "#cfeeee",
          border: "none",
          borderRadius: "12px",
          fontSize: "18px",
          color: "#006b5f",
          cursor: "pointer"
        }}
      >
        登録してホームへ進む
      </button>
    </main>
  );
}
