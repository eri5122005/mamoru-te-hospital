"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function WardHome() {
  const router = useRouter();
  const [wards, setWards] = useState([]);

  // ★ 病棟一覧の初期データ（透析室を含む）
  const defaultWards = [
    { id: "4f", name: "4階病棟" },
    { id: "5f", name: "5階病棟" },
    { id: "6f", name: "6階病棟" },
    { id: "78f", name: "7.8階病棟" },
    { id: "gairai", name: "外来" },
    { id: "riha", name: "リハビリ" },
    { id: "ikyoku", name: "医局" },
    { id: "touseki", name: "透析室" }, // ★ 追加
  ];

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("wards") || "null");

    // ★ 初回だけ wards を保存する
    if (!stored || stored.length === 0) {
      localStorage.setItem("wards", JSON.stringify(defaultWards));
      setWards(defaultWards);
    } else {
      setWards(stored);
    }
  }, []);

  return (
    <main
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "24px",
        fontFamily: "sans-serif",
      }}
    >
      <h1
        style={{
          color: "#00a68c",
          marginBottom: "20px",
          textAlign: "center",
        }}
      >
        病棟一覧
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "20px",
        }}
      >
        {wards.map((ward) => (
          <div
            key={ward.id}
            onClick={() => router.push(`/admin/ward/${ward.id}`)}
            style={{
              background: "#e8f6f6",
              borderRadius: "20px",
              padding: "24px",
              textAlign: "center",
              cursor: "pointer",
              border: "2px solid #aeece4",
            }}
          >
            <div style={{ fontSize: "40px", marginBottom: "12px", color: "#00a68c" }}>
              🏥
            </div>
            <p>{ward.name}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
