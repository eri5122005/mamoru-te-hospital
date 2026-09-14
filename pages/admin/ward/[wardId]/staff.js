"use client";

import { useSearchParams } from "next/navigation";   // ★ 追加
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { db } from "@/firebaseConfig";
import BackButton from "@/components/BackButton";
import { collection, getDocs } from "firebase/firestore";

export default function StaffList() {
  const router = useRouter();
  const { wardId } = router.query;

  // ★ from=admin を受け取る
  const searchParams = useSearchParams();
  const fromAdmin = searchParams.get("from") === "admin";

  // ★ 戻る先を分岐
  const backTo = fromAdmin
    ? `/admin/ward/${wardId}?from=admin`
    : `/admin/ward/${wardId}`;

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const wardNameMap = {
    "4f": "4階",
    "5f": "5階",
    "6f": "6階",
    "78f": "7・8階",
    "gairai": "外来",
    "touseki": "透析室",
    "ikyoku": "医局",
  };

  useEffect(() => {
    if (!wardId) return;

    const fetchData = async () => {
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs
        .map((d) => d.data())
        .filter((s) => s.wardId === wardId && s.isActive);

      setStaff(staffList);
      setLoading(false);
    };

    fetchData();
  }, [wardId]);

  if (loading) {
    return (
      <main style={{ padding: "24px" }}>
        {/* ★ 修正：backTo を使う */}
        <BackButton to={backTo} />
        <p style={{ textAlign: "center", color: "#006b5f" }}>読み込み中…🫧</p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      {/* ★ 修正：backTo を使う */}
      <BackButton to={backTo} />

      {/* タイトル */}
      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
          lineHeight: "1.4",
        }}
      >
        💠 {wardNameMap[wardId]} スタッフ一覧
      </h1>

      {/* スタッフ一覧 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {staff.map((s) => (
          <div
            key={s.staffId}
            style={{
              background: "#e8f6f6",
              border: "1px solid #cfeeee",
              borderRadius: "16px",
              padding: "18px",
              color: "#006b5f",
              fontSize: "18px",
              lineHeight: "1.5",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              🔹 {s.name}（ID: {s.staffId}）
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "#008080",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              💧 今月の使用量：{s.monthlyUsage ?? 0} mL
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "#008080",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              ✨ 入力率：{s.inputRate ?? 0} %
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
