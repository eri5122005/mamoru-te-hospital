"use client";

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import NavBar from "../../components/NavBar";

// ★ Firestore 追加
import { db } from "../../firebaseConfig";
import { setDoc, doc } from "firebase/firestore";

export default function FirstLogin() {
  const router = useRouter();

  const [realStaffId, setRealStaffId] = useState("");

  useEffect(() => {
    if (!router.isReady) return;

    const id = router.query.staffId;
    if (id) {
      setRealStaffId(id);
    }
  }, [router.isReady]);

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [workDays, setWorkDays] = useState("");

  const handleRegister = async () => {
    if (!name || !department || !workDays) return;

    const wardMap = {
      "4階病棟": "4f",
      "5階病棟": "5f",
      "6階病棟": "6f",
      "7.8階病棟": "78f",
      "外来": "gairai",
      "透析室": "touseki",
      "リハビリ": "riha",
      "医局": "ikyoku",
    };

    const wardId = wardMap[department];

    const staffData = {
      staffId: realStaffId,
      name,
      department,
      wardId,
      workDays,
      role: "staff",
      isActive: true,   // ★ 在職フラグ（退職時は false にする）
    };

    // ★ Firestore に登録
    await setDoc(doc(db, "staff", realStaffId), staffData);

    // ★ localStorage に保存
    localStorage.setItem(`staff-${realStaffId}`, JSON.stringify(staffData));
    localStorage.setItem("currentStaff", JSON.stringify(staffData));

    router.replace("/home");
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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />

          <label style={{ color: "#006b5f", fontSize: "14px" }}>部署</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={inputStyle}
          >
            <option value="">選択してください</option>
            <option value="4階病棟">4階病棟</option>
            <option value="5階病棟">5階病棟</option>
            <option value="6階病棟">6階病棟</option>
            <option value="7.8階病棟">7.8階病棟</option>
            <option value="外来">外来</option>
            <option value="透析室">透析室</option>
            <option value="リハビリ">リハビリ</option>
            <option value="医局">医局</option>
          </select>

          <label style={{ color: "#006b5f", fontSize: "14px" }}>
            月の勤務日数
          </label>
          <input
            type="number"
            value={workDays}
            onChange={(e) => setWorkDays(e.target.value)}
            style={inputStyle}
          />

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
