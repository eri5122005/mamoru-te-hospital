"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";


export default function AdminSettings() {
  const router = useRouter();

  const [loginUser, setLoginUser] = useState({});
  const [wards, setWards] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    const savedLogin = JSON.parse(localStorage.getItem("loginUser") || "{}");
    const savedWards = JSON.parse(localStorage.getItem("wards") || "[]");
    const savedStaff = JSON.parse(localStorage.getItem("staffList") || "[]");

    setLoginUser(savedLogin);
    setWards(savedWards);
    setStaffList(savedStaff);
  }, []);

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <h1 style={{ color: "#006b5f", marginBottom: "24px", textAlign: "center" }}>
        ⚙️ 設定（病棟・スタッフ管理）
      </h1>

      {/* 病棟管理 */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ color: "#006b5f", fontSize: "22px", marginBottom: "12px" }}>
          🏥 病棟管理
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
         {wards.map((ward) => (
  <div
    key={ward.id}
    style={{
      background: "#ffffff",
      border: "1px solid #cfeeee",
      borderRadius: "16px",
      padding: "16px",
      fontSize: "18px",
      color: "#006b5f",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}
  >
    {ward.name}（ID: {ward.id}）

    <button
      style={{
        background: "#ffdddd",
        color: "#a30000",
        padding: "6px 12px",
        borderRadius: "8px",
        border: "none",
        cursor: "pointer"
      }}
      onClick={() => {
        const saved = JSON.parse(localStorage.getItem("wards") || "[]");
        const updated = saved.filter((w) => w.id !== ward.id);

        localStorage.setItem("wards", JSON.stringify(updated));
        setWards(updated);
      }}
    >
      削除
    </button>
  </div>
))}


        </div>

        {loginUser.isSuperAdmin && (
          <button
            style={buttonStyle}
            onClick={() => router.push("/admin/settings/wards")}
          >
            ➕ 病棟を追加する
          </button>
        )}
      

      </section>

      {/* スタッフ管理 */}
      <section>
        <h2
          style={{
            color: "#006b5f",
            fontSize: "22px",
            marginBottom: "12px",
            borderLeft: "6px solid #cfeeee",
            paddingLeft: "10px",
          }}
        >
          👤 スタッフ管理
        </h2>

        <p style={{ color: "#006b5f", marginBottom: "12px" }}>
          ※ スタッフ名を選択すると削除ボタンが表示されます（データは残ります）
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {wards.map((ward) => (
  <div
    key={ward.id}
    onClick={() => setSelectedWard(ward.id)}   // ★追加
    style={{
      background: selectedWard === ward.id ? "#e8f6f6" : "#ffffff",
      border: "1px solid #cfeeee",
      borderRadius: "16px",
      padding: "16px",
      fontSize: "18px",
      color: "#006b5f",
      cursor: "pointer"
    }}
  >
    {ward.name}（ID: {ward.id}）
  </div>
))}
{selectedWard && (
  <button
    style={{
      marginTop: "16px",
      background: "#ffdddd",
      color: "#a30000",
      padding: "14px 20px",
      borderRadius: "12px",
      border: "none",
      fontSize: "18px",
      cursor: "pointer",
      width: "100%"
    }}
    onClick={() => {
      const saved = JSON.parse(localStorage.getItem("wards") || "[]");
      const updated = saved.filter((w) => w.id !== selectedWard);

      localStorage.setItem("wards", JSON.stringify(updated));
      setWards(updated);
      setSelectedWard(null);
    }}
  >
    選択した病棟を削除する
  </button>
)}

        </div>

        {selectedStaff && (
          <button
            style={{
              marginTop: "24px",
              background: "#ffdddd",
              color: "#a30000",
              padding: "14px 20px",
              borderRadius: "12px",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              width: "100%",
              textAlign: "center",
            }}
            onClick={() => {
              const saved = JSON.parse(localStorage.getItem("staffList") || "[]");
              const updated = saved.filter((s) => s.staffId !== selectedStaff);

              localStorage.setItem("staffList", JSON.stringify(updated));
              setStaffList(updated);
              setSelectedStaff(null);
            }}
          >
            選択したスタッフを削除（退職）
          </button>
        )}

        <button
          style={{
            ...buttonStyle,
            marginTop: "24px",
            width: "100%",
          }}
          onClick={() => router.push("/admin/settings/staff")}
        >
          ➕ スタッフを追加する
        </button>
      </section>

      {/* 管理メニューへ戻る */}
<div
  onClick={() => router.push("/admin")}
  style={{
    marginTop: "32px",
    background: "#ffffff",
    border: "1px solid #cfeeee",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "center",
    cursor: "pointer",
    color: "#006b5f",
  }}
>
  ← 管理メニューに戻る
</div>

<LogoutButton />

</main>

  );
}

const buttonStyle = {
  marginTop: "16px",
  background: "#4BB5C1",
  color: "white",
  padding: "12px 20px",
  borderRadius: "12px",
  border: "none",
  fontSize: "18px",
  cursor: "pointer",
};
