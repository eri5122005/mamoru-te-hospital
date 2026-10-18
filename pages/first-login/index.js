"use client";

import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import NavBar from "../../components/NavBar";

// ★ Firestore 追加
import { db } from "../../firebaseConfig";
import { doc, runTransaction } from "firebase/firestore";
import { normalizeStaffId } from "../../utils/normalizeStaffId";

export default function FirstLogin() {
  const router = useRouter();

  const [realStaffId, setRealStaffId] = useState("");
  const [lastName, setLastName] = useState("");
const [firstName, setFirstName] = useState("");
  const [department, setDepartment] = useState("");
  const [workDays, setWorkDays] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    const queryId = router.query.staffId;
    setRealStaffId(typeof queryId === "string" ? normalizeStaffId(queryId) : "");
  }, [router.isReady, router.query.staffId]);

  const handleRegister = async () => {
  const queryId = router.query.staffId;
  if (!router.isReady || typeof queryId !== "string" || !realStaffId ||
      normalizeStaffId(queryId) !== realStaffId) {
    alert("職員番号を確認できません。ログイン画面からやり直してください。");
    return;
  }
  if (!lastName || !firstName || !department) return;

  const workDayCount = Number(workDays);
  if (!Number.isInteger(workDayCount) || workDayCount <= 0) {
    alert("勤務日数は1以上の整数で入力してください。");
    return;
  }

  const formattedName =
    `${lastName.trim()} ${firstName.trim()}`;

    const wardMap = {
      "看護部": "nursing",
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
      workDays: workDayCount,
      role: "staff",
      isActive: true,
      mode: "weight",
    };

    let result;
    try {
      result = await runTransaction(db, async (transaction) => {
        const staffRef = doc(db, "staff", realStaffId);
        const backupRef = doc(db, "staffs", realStaffId);
        const staffSnap = await transaction.get(staffRef);
        const backupSnap = await transaction.get(backupRef);

        if (staffSnap.exists()) return "staff-exists";
        if (backupSnap.exists()) return "backup-exists";

        transaction.set(staffRef, staffData);
        transaction.set(backupRef, { ...staffData, lastWeight: null });
        return "created";
      });
    } catch (error) {
      console.error("初回登録に失敗しました", error);
      alert("登録結果を確認できませんでした。再登録せず、管理者に確認してください。");
      return;
    }

    if (result === "staff-exists") {
      alert("この職員番号は登録済みです。ログイン画面からログインしてください。");
      router.replace("/login");
      return;
    }
    if (result === "backup-exists") {
      alert("登録済み情報が見つかりました。再登録せず、管理者に確認してください。");
      return;
    }

    // トランザクション成功後にだけ端末へ保存する
    localStorage.setItem(`staff-${realStaffId}`, JSON.stringify(staffData));
    localStorage.setItem("currentStaff", JSON.stringify(staffData));

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
            <option value="看護部">看護部</option>
          </select>

          <label htmlFor="workDays" style={{ color: "#006b5f", fontSize: "14px" }}>
            月の勤務日数
          </label>
          <p id="workDays-help" style={{ margin: "8px 0 12px", color: "#526763", fontSize: "14px", lineHeight: 1.6 }}>
            月20日勤務の方は、下のボタンを押してください
          </p>
          <button
            type="button"
            onClick={() => setWorkDays(20)}
            style={{
              width: "100%",
              minHeight: "48px",
              padding: "12px 16px",
              background: "#DFF7F2",
              color: "#006b5f",
              border: "2px solid #83c9bb",
              borderRadius: "10px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            20日を入力
          </button>
          <p style={{ margin: "16px 0 8px", textAlign: "center", color: "#526763", fontSize: "14px" }}>または</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              id="workDays"
              aria-describedby="workDays-help"
              type="number"
              value={workDays}
              onChange={(e) => setWorkDays(e.target.value)}
              placeholder="勤務日数"
              style={{
                ...inputStyle,
                boxSizing: "border-box",
                width: "120px",
                maxWidth: "100%",
                minWidth: 0,
                marginTop: 0,
                marginBottom: 0,
              }}
            />
            <span style={{ color: "#006b5f", flexShrink: 0 }}>日</span>
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
