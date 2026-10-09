"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

export default function Login() {
  const router = useRouter();
  const [staffId, setStaffId] = useState("");

  // ★ ログイン画面を開いた瞬間にローカルストレージを強制クリア
  useEffect(() => {
    const mode = localStorage.getItem("trainingMode");

    if (mode === "off") {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("staff-")) localStorage.removeItem(key);
        if (/^\d+$/.test(key)) localStorage.removeItem(key);
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

  // ★ ログイン処理（ここだけ使う）
  const handleLogin = async () => {
    if (!staffId) return;

    // ★ 総合管理者（9999）
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
          mode: "weight",
          lastWeight: 1,
          emptyWeight: 1,
        })
      );
      router.replace("/admin");
      return;
    }

    // ★ 部署管理者
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
  "2900": "shisetsu",
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
          mode: "weight",
          lastWeight: 1,
          emptyWeight: 1,
        })
      );
      router.replace(`/admin/ward/${dept}`);
      return;
    }

    // ★ 一般スタッフ（Firestore の staff を基準にする）
try {
  const staffRef = doc(db, "staff", staffId);
  const staffSnap = await getDoc(staffRef);

  // Firestore に存在しないスタッフだけ初回登録へ
  if (!staffSnap.exists()) {
    router.replace(`/first-login?staffId=${staffId}`);
    return;
  }

  const staffData = staffSnap.data();

  // ★ Firestore の最新情報から currentStaff を作成
  const current = {
    staffId: staffData.staffId ?? staffId,
    name: staffData.name,
    department: staffData.department,
    wardId: staffData.wardId,
    workDays: staffData.workDays,
    role: staffData.role,
    mode: staffData.mode ?? null,
    lastWeight:
      staffData.lastWeight === undefined ? null : staffData.lastWeight,
    emptyWeight:
      staffData.emptyWeight === undefined ? null : staffData.emptyWeight,
  };

  // ★ この端末の情報も Firestore の最新状態にそろえる
  localStorage.setItem("currentStaff", JSON.stringify(current));
  localStorage.setItem(`staff-${staffId}`, JSON.stringify(current));

  // ★ 初回重さ登録が必要か確認
  const needFirstWeight =
    current.mode !== "weight" ||
    current.lastWeight === null ||
    current.emptyWeight === null;

  if (needFirstWeight) {
    router.replace("/first-weight");
    return;
  }

  // ★ 記録ページへ
  router.replace("/record");
} catch (error) {
  console.error("スタッフ情報の取得に失敗しました", error);
  return;
}
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
