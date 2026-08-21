"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function RegisterPage() {
  const router = useRouter();

  const [staffId, setStaffId] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [workDays, setWorkDays] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("loginUser");
      if (!raw) return;

      const loginUser = JSON.parse(raw);
      setStaffId(loginUser.staffId);
      setName(loginUser.name);
      setDepartment(loginUser.department);
    } catch (e) {
      console.error(e);
    }
  }, []);

 const handleRegister = async () => {
  if (!name || !department || !workDays) {
    alert("名前・病棟・勤務日数を入力してください");
    return;
  }

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffId,
        name,
        wardName: department,
        workDays: Number(workDays),
      }),
    });

    const data = await res.json();

    // ★ Firestore に staff を自動登録
    await setDoc(doc(db, "staff", staffId), {
      staffId,
      name,
      department,
      wardId: department,
      workDays: Number(workDays),
      role: "staff",
    });

    const staffData = {
      staffId,
      name,
      department,
      workDays: Number(workDays),
      isAdmin: false,
      isSuperAdmin: false,
    };

    localStorage.setItem("loginUser", JSON.stringify(staffData));

    router.replace("/home");
  } catch (error) {
    console.error("登録APIエラー:", error);
    alert("登録処理でエラーが発生しました");
  }
};

  return (
    <main style={{ padding: "20px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
        初回登録
      </h1>

      <div
        onClick={() => router.replace("/login")}
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

      {/* 以下はそのまま */}
      …
    </main>
  );
}
