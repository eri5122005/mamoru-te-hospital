"use client";

import { useRouter } from "next/router";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [staffId, setStaffId] = useState("");

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

      router.replace("/admin/top");

      return;
    }

    // ★ staff-XXXX を読み込む（初回登録データ）
    const raw = localStorage.getItem(`staff-${staffId}`);

    if (!raw) {
      // 初回ログイン → first-login へ
      router.replace(`/first-login?staffId=${staffId}`);
      return;
    }

    // ★ 初回登録済み → currentStaff を保存
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
      })
    );

    // ★ 管理者ID → 部署名の対応表
    const departmentAdmins = {
      2400: "4f",
      2500: "5f",
      2600: "6f",
      2700: "78f",
      2305: "touseki",
      2150: "gairai",
      2300: "ikyoku",
    };

    // ★ currentStaff を読み込む
    const current = JSON.parse(localStorage.getItem("currentStaff"));

    // ★ 部署管理者
    if (departmentAdmins[current.staffId]) {
      const dept = departmentAdmins[current.staffId];
      router.replace(`/admin/ward/${dept}`);
      return;
    }

    // ★ 一般スタッフ
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
