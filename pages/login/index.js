"use client";

import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function Login() {
  const router = useRouter();
  const [staffId, setStaffId] = useState("");

  // ★ ログイン画面を開いた瞬間にローカルストレージを強制クリア
useEffect(() => {
  const mode = localStorage.getItem("trainingMode");

  if (mode === "off") {
    Object.keys(localStorage).forEach((key) => {
      // staff-XXXX を削除
      if (key.startsWith("staff-")) {
        localStorage.removeItem(key);
      }

      // 数字だけのキー（例：4358）も削除
      if (/^\d+$/.test(key)) {
        localStorage.removeItem(key);
      }

      // 初回判定に使うキーも削除
      if (
        key === "currentStaff" ||
        key === "loginUser" ||
        key === "staffList"
      ) {
        localStorage.removeItem(key);
      }
    });
  }
}, []);


  const handleLogin = () => {
    if (!staffId) return;

    // ★ 総合管理者（9999）は初回登録不要
    if (staffId === "9999") {
      localStorage.setItem(
        "currentStaff",
        JSON.stringify({
          staffId: "9999",
          name: "総合管理者",
          department: "super",
          wardId: "",
          workDays: [],
          role: "super",
        })
      );

      router.replace("/admin");
      return;
    }

    const departmentAdmins = {
      "2100": "gairai",
      "2150": "gairai",
      "2200": "riha",
      "2201": "riha",
      "2300": "ikyoku",
      "2305": "touseki",
      "2400": "4f",
      "2444": "4f",
      "2500": "5f",
      "2555": "5f",
      "2600": "6f",
      "2666": "6f",
      "2700": "78f",
      "2777": "78f",
    };

    if (departmentAdmins[staffId]) {
      const dept = departmentAdmins[staffId];

      localStorage.setItem(
        "currentStaff",
        JSON.stringify({
          staffId,
          name: "部署管理者",
          department: dept,
          wardId: dept,
          workDays: [],
          role: "admin",
        })
      );

      router.replace(`/admin/ward/${dept}`);
      return;
    }

    // ★ staff-XXXX を読み込む（初回登録データ）
    const raw = localStorage.getItem(`staff-${staffId}`);

    if (!raw) {
      router.replace(`/first-login?staffId=${staffId}`);
      return;
    }

    const staffData = JSON.parse(raw);

    localStorage.setItem(
      "currentStaff",
      JSON.stringify({
        staffId: staffData.staffId,
        name: staffData.name,
        department: staffData.department,
        wardId: staffData.wardId,
        workDays: staffData.workDays,
        role: staffData.role,
        mode: staffData.mode,
        lastWeight: staffData.lastWeight || null,
        emptyWeight: staffData.emptyWeight || null,
      })
    );

    router.replace("/home");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          padding: "32px",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            marginBottom: "20px",
            color: "#006b5f",
            textAlign: "center",
          }}
        >
          🔐 ログイン
        </h1>

        <label style={{ fontSize: "14px", color: "#333" }}>職員番号</label>
        <input
          id="staffId"
          type="text"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          placeholder="例：123"
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "6px",
            marginBottom: "24px",
            borderRadius: "10px",
            border: "1px solid var(--mint-light)",
            fontSize: "16px",
          }}
        />

        <button
          onClick={handleLogin}
          style={{
            width: "100%",
            padding: "14px",
            background: "var(--mint-light)",
            color: "#006b5f",
            border: "none",
            borderRadius: "10px",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          ログイン →
        </button>
      </div>
    </div>
  );
}
