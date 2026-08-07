"use client";

import { useRouter } from "next/router";

export default function DepartmentLogin() {
  const router = useRouter();

  const departments = [
    { name: "4階病棟", id: "2400" },
    { name: "5階病棟", id: "2500" },
    { name: "6階病棟", id: "2600" },
    { name: "7.8階病棟", id: "2700" },
    { name: "外来", id: "2150" },
    { name: "リハビリ", id: "2200" },
    { name: "医局", id: "2300" },
  ];

  const loginAsDepartment = (dept) => {
    const adminUser = {
      staffId: dept.id,
      name: `${dept.name} 管理者`,
      department: dept.name,
      isAdmin: true,
      isSuperAdmin: false,
    };

    localStorage.setItem("currentStaff", JSON.stringify(adminUser));
    localStorage.setItem("loginUser", JSON.stringify(adminUser));

    // ★ 修正ポイント：最後に / をつける
    router.push(`/admin/ward/${dept.name}/`);
  };

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
        <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>
          部署管理者ログイン
        </h1>

        {departments.map((dept) => (
          <div
            key={dept.id}
            onClick={() => loginAsDepartment(dept)}
            style={{
              padding: "14px",
              background: "#cfeeee",
              borderRadius: "12px",
              fontSize: "18px",
              color: "#006b5f",
              cursor: "pointer",
              marginBottom: "16px",
            }}
          >
            {dept.name} 管理者ログイン
          </div>
        ))}

        <div
          onClick={() => router.push("/login")}
          style={{
            padding: "14px",
            background: "#cfeeee",
            borderRadius: "12px",
            fontSize: "18px",
            color: "#006b5f",
            cursor: "pointer",
            marginTop: "10px",
            textAlign: "center",
          }}
        >
          ← ログイン画面に戻る
        </div>
      </div>
    </main>
  );
}

