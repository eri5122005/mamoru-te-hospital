"use client";

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import NavBar from "../../components/NavBar";

// ★ Firestore 追加
import { db } from "../../firebaseConfig";
import { setDoc, doc, getDoc } from "firebase/firestore";

export default function FirstLogin() {
  const router = useRouter();

  const [realStaffId, setRealStaffId] = useState("");
  const [lastName, setLastName] = useState("");
const [firstName, setFirstName] = useState("");
  const [department, setDepartment] = useState("");
  const [workDays, setWorkDays] = useState("");

  // ★★★ useEffect（壊れていた部分を完全修復）★★★
  useEffect(() => {
  if (!router.isReady) return;

  const staffId = router.query.staffId;
  if (!staffId) return;

  setRealStaffId(staffId);

  // ★ staff-XXXX が存在するかどうかで判定（最重要）
  const localStaff = localStorage.getItem(`staff-${staffId}`);

  if (localStaff) {
    const parsed = JSON.parse(localStaff);

    // ★ 初回登録済み（lastWeight あり）
    if (parsed.lastWeight) {
      router.replace("/record");
      return;
    }

    // ★ 初回登録済みだが重さ未入力
    router.replace("/first-weight");
    return;
  }

  // ★ staff-XXXX が無い → 初回登録が必要
  // このまま first-login を表示
}, [router.isReady]);
  
  const handleRegister = async () => {
  if (!lastName || !firstName || !department || !workDays) return;

  const formattedName =
    `${lastName.trim()} ${firstName.trim()}`;

    const wardMap = {
      "4階": "4f",
      "5階": "5f",
      "6階": "6f",
      "7.8階": "78f",
      "外来": "gairai",
      "透析室": "touseki",
      "リハビリ": "riha",
      "医局": "ikyoku",
      "施設管理": "shisetsu",
    };

    const wardId = wardMap[department];

    const staffData = {
      staffId: realStaffId,
      name: formattedName,
      department,
      wardId,
      workDays,
      role: "staff",
      isActive: true,
      mode: "weight",
    };

    // ★ Firestore（既存の staff コレクション）
    await setDoc(doc(db, "staff", realStaffId), staffData);

    // ★ localStorage 保存（既存）
    localStorage.setItem(`staff-${realStaffId}`, JSON.stringify(staffData));
    localStorage.setItem("currentStaff", JSON.stringify(staffData));

    // ★★★ クラウドバックアップ（staffs コレクション）★★★
    await setDoc(doc(db, "staffs", realStaffId), {
      ...staffData,
      lastWeight: null,
    });

    // ★ 初期重さ入力画面へ
    router.replace("/first-weight");
  };

  return (
    <>
      <main
        style={{
          minHeight: "100vh",
          background: "#F9F9F9",
          padding: "24px",
          fontFamily: "sans-serif",
        }}
      >
        <h1
          style={{
            color: "#006b5f",
            textAlign: "center",
            marginBottom: "24px",
            fontSize: "26px",
            fontWeight: "600",
            letterSpacing: "1px",
            padding: "10px 0",
            borderBottom: "3px solid #cfeeee",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
          }}
        >
          📝 初回登録
        </h1>

        <div
          style={{
            background: "#ffffff",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            border: "1px solid #e0f4f4",
            maxWidth: "420px",
            margin: "0 auto",
          }}
        >
          <label style={{ color: "#006b5f", fontSize: "14px" }}>
            職員番号（自動入力）
          </label>
          <input type="text" value={realStaffId} readOnly style={inputStyle} />

          <label style={{ color: "#006b5f", fontSize: "14px" }}>氏名</label>

<div style={{ display: "flex", gap: "10px" }}>
  <div style={{ flex: 1 }}>
    <label
      style={{
        color: "#006b5f",
        fontSize: "12px",
        display: "block",
        marginBottom: "4px",
      }}
    >
      姓
    </label>
    <input
      type="text"
      value={lastName}
      onChange={(e) => setLastName(e.target.value)}
      placeholder="山田"
      style={inputStyle}
    />
  </div>

  <div style={{ flex: 1 }}>
    <label
      style={{
        color: "#006b5f",
        fontSize: "12px",
        display: "block",
        marginBottom: "4px",
      }}
    >
      名
    </label>
    <input
      type="text"
      value={firstName}
      onChange={(e) => setFirstName(e.target.value)}
      placeholder="太郎"
      style={inputStyle}
    />
  </div>
</div>

          <label style={{ color: "#006b5f", fontSize: "14px" }}>部署</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={inputStyle}
          >
            <option value="">選択してください</option>
            <option value="4階">4階</option>
            <option value="5階">5階</option>
            <option value="6階">6階</option>
            <option value="7.8階">7.8階</option>
            <option value="外来">外来</option>
            <option value="透析室">透析室</option>
            <option value="リハビリ">リハビリ</option>
            <option value="医局">医局</option>
            <option value="施設管理">施設管理</option>
          </select>

          <label style={{ color: "#006b5f", fontSize: "14px" }}>
            月の勤務日数
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input
              type="number"
              value={workDays}
              onChange={(e) => setWorkDays(e.target.value)}
              placeholder="勤務日数"
              style={{
                ...inputStyle,
                width: "120px",
                marginBottom: 0,
              }}
            />

            <button
              onClick={() => setWorkDays(20)}
              style={{
                background: "#DFF7F2",
                color: "#006b5f",
                border: "1px solid #cfeeee",
                borderRadius: "20px",
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              常勤（20日）
            </button>
          </div>

          <button
            onClick={handleRegister}
            style={{
              width: "100%",
              padding: "14px",
              background: "#cfeeee",
              color: "#006b5f",
              border: "none",
              borderRadius: "12px",
              fontSize: "18px",
              cursor: "pointer",
              marginTop: "20px",
            }}
          >
            🌿 登録する
          </button>
        </div>
      </main>

      <NavBar />
    </>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginTop: "6px",
  marginBottom: "16px",
  borderRadius: "10px",
  border: "1px solid #cfeeee",
  fontSize: "16px",
  background: "#f5fafa",
};
