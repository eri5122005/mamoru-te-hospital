"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { normalizeStaffId } from "../../utils/normalizeStaffId";
import { clearRecordDraft } from "../../utils/recordUpdateDraft";
import { clearLoginIdentity } from "../../utils/clearLoginIdentity";
import { isActiveStaff } from "../../utils/isActiveStaff";

export default function Login() {
  const router = useRouter();
  const [staffId, setStaffId] = useState("");
  const [loginError, setLoginError] = useState("");
  const loginBusyRef = useRef(false);
  const loginActiveRef = useRef(true);

  useEffect(() => {
    try { clearRecordDraft(sessionStorage); } catch { /* Record startup fails closed if storage remains unavailable. */ }
    loginActiveRef.current = true;
    try { clearLoginIdentity(localStorage); } catch (error) { setLoginError(error.message); }
    return () => { loginActiveRef.current = false; };
  }, []);

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
    if (loginBusyRef.current || !loginActiveRef.current) return;
    loginBusyRef.current = true;
    try {
    try { clearLoginIdentity(localStorage); setLoginError(""); }
    catch (error) { setLoginError(error.message); return; }
    try { clearRecordDraft(sessionStorage); } catch { /* Never restore another ID. */ }
    const normalizedStaffId = normalizeStaffId(staffId);
    if (!normalizedStaffId) return;

    // ★ 総合管理者（9999）
    if (normalizedStaffId === "9999") {
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

    if (departmentAdmins[normalizedStaffId]) {
      const dept = departmentAdmins[normalizedStaffId];
      localStorage.setItem(
        "currentStaff",
        JSON.stringify({
          staffId: normalizedStaffId,
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
  const staffRef = doc(db, "staff", normalizedStaffId);
  const staffSnap = await getDoc(staffRef);
  if (!loginActiveRef.current) return;

  // Firestore に存在しないスタッフだけ初回登録へ
  if (!staffSnap.exists()) {
    router.replace(`/first-login?staffId=${encodeURIComponent(normalizedStaffId)}`);
    return;
  }

  const staffData = staffSnap.data();
  if (!isActiveStaff(staffData)) {
    alert("この職員番号は現在利用できません。管理者に確認してください。");
    return;
  }

  // ★ Firestore の最新情報から currentStaff を作成
  const current = {
    staffId: normalizedStaffId,
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
  localStorage.setItem(`staff-${normalizedStaffId}`, JSON.stringify(current));

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
    } finally { loginBusyRef.current = false; }
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

        {loginError && <p role="alert">{loginError}</p>}
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
