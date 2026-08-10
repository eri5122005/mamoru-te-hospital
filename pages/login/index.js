"use client";

import { useRouter } from "next/router";
import { useState, useEffect } from "react";

export default function Login() {
  const router = useRouter();

  const [staffId, setStaffId] = useState("");
  const [savedStaff, setSavedStaff] = useState(null);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");

  // ★ 職員番号が入力されたら savedStaff をチェック
  useEffect(() => {
    // 新しい番号を入力したらリセット
    setName("");
    setDepartment("");

    if (staffId) {
      const stored = JSON.parse(localStorage.getItem(staffId) || "null");
      setSavedStaff(stored);

      if (stored) {
        setName(stored.name);
        setDepartment(stored.department);
      }
    }
  }, [staffId]);

  const adminIds = {
    "9999": "管理部",
    "2400": "4階病棟",
    "2500": "5階病棟",
    "2600": "6階病棟",
    "2700": "7.8階病棟",
    "2150": "外来",
    "2200": "リハビリ",
    "2300": "医局",
  };

  const handleLogin = () => {
  if (!staffId) {
    alert("職員番号を入力してください");
    return;
  }

  // ★ マスター管理者（総合管理者）
  if (staffId === "9999") {
    const adminUser = {
      staffId,
      name: "マスター管理者",
      department: "管理部",
      isAdmin: true,
      isSuperAdmin: true,
    };

    localStorage.setItem("loginUser", JSON.stringify(adminUser));
    router.push("/admin");   // ← 総合管理者トップへ
    return;
  }

// ★ 部署管理者（2400〜2700）
if (adminIds[staffId]) {

  const wards = JSON.parse(localStorage.getItem("wards") || "[]");
  const ward = wards.find((w) => w.name === adminIds[staffId]);

  const adminUser = {
    staffId,
    name: `${adminIds[staffId]} 管理者`,
    wardId: ward ? ward.id : null,      // ★ 病棟ID
    wardName: adminIds[staffId],        // ★ 病棟名
    isAdmin: true,
    isSuperAdmin: false,
  };

  // ★ staffList に追加（総合管理者ページの反映に必要）
  const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");
  const exists = staffList.some((s) => s.staffId === staffId);

  if (!exists) {
    staffList.push(adminUser);
    localStorage.setItem("staffList", JSON.stringify(staffList));
  }

  localStorage.setItem("loginUser", JSON.stringify(adminUser));
  router.push(`/admin/ward/${adminUser.wardId}`);
  return;
}





// ★ 一般職員ログイン
const wards = JSON.parse(localStorage.getItem("wards") || "[]");
const ward = wards.find((w) => w.name === department);

const loginUser = {
  staffId,
  name,
  wardId: ward ? ward.id : null,
  wardName: ward ? ward.name : department,
  isAdmin: false,
  isSuperAdmin: false,
};


// ★ 職員番号をキーにして保存（これが重要）
localStorage.setItem(staffId, JSON.stringify(loginUser));

// ★ 現在ログイン中のユーザーとしても保存
localStorage.setItem("loginUser", JSON.stringify(loginUser));
localStorage.setItem("currentStaff", JSON.stringify(loginUser));


 const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");
const exists = staffList.some((s) => s.staffId === staffId);

if (!exists) {
  staffList.push(loginUser);
  localStorage.setItem("staffList", JSON.stringify(staffList));
}

router.push("/home");



  // ★ ここが本来の return（画面部分）
  return (
    <main
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "20px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          padding: "28px",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "380px",
          border: "1px solid #cfeeee",
          textAlign: "center",
        }}
      >
        <h1 style={{ color: "#006b5f", marginBottom: "6px" }}>ログイン</h1>

        <div
          style={{
            fontSize: "40px",
            marginBottom: "20px",
            color: "#00a68c",
          }}
        >
          🧴
        </div>

        <p style={{ color: "#008b75", marginBottom: "20px", fontSize: "14px" }}>
          職員番号を入力してください
        </p>

        <input
          type="text"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          placeholder="職員番号（例：1001）"
          style={inputStyle}
        />

        {/* ★ savedStaff がない時だけ氏名・部署入力欄を表示 */}
        {!savedStaff && staffId && !adminIds[staffId] && (
          <>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名前（例：山田）"
              style={inputStyle}
            />

            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #cfeeee",
                marginBottom: "20px",
                fontSize: "16px",
                background: "#ffffff",
              }}
            >
              <option value="">病棟を選択してください</option>
              <option value="4階病棟">4階病棟</option>
              <option value="5階病棟">5階病棟</option>
              <option value="6階病棟">6階病棟</option>
              <option value="7.8階病棟">7.8階病棟</option>
              <option value="外来">外来</option>
              <option value="リハビリ">リハビリ</option>
              <option value="医局">医局</option>
            </select>
          </>
        )}

        <button style={loginButtonStyle} onClick={handleLogin}>
          ログイン →
        </button>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #cfeeee",
  marginBottom: "16px",
  fontSize: "16px",
};

const loginButtonStyle = {
  padding: "14px",
  background: "#cfeeee",
  border: "none",
  borderRadius: "12px",
  fontSize: "18px",
  color: "#006b5f",
  cursor: "pointer",
  width: "100%",
  marginBottom: "16px",
  textAlign: "center",
};
