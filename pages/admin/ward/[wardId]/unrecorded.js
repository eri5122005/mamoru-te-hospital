"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { db } from "@/firebaseConfig";
import BackButton from "@/components/BackButton";

import { collection, getDocs } from "firebase/firestore";

export default function UnrecordedList() {
  const router = useRouter();
  const { wardId } = router.query;

  const [unrecorded, setUnrecorded] = useState([]);
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
      const today = new Date();

      const staffSnap = await getDocs(collection(db, "staff"));
      const staff = staffSnap.docs
        .map((d) => d.data())
        .filter((s) => s.wardId === wardId && s.isActive);

      const recSnap = await getDocs(collection(db, "records"));
      const records = recSnap.docs.map((d) => d.data());

      const unrecList = [];

      for (const s of staff) {
        const myRecords = records.filter(
          (r) => String(r.staffId) === String(s.staffId)
        );

        if (myRecords.length === 0) {
          unrecList.push({
            name: s.name,
            staffId: s.staffId,
            lastDate: "記録なし",
            diffDays: null,
          });
          continue;
        }

        const lastRecord = myRecords.sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        )[0];

        const lastDate = new Date(lastRecord.date);

        const diffDays = Math.floor(
          (today - lastDate) / (1000 * 60 * 60 * 24)
        );

        if (diffDays >= 7) {
          unrecList.push({
            name: s.name,
            staffId: s.staffId,
            lastDate: lastRecord.date,
            diffDays,
          });
        }
      }

      setUnrecorded(unrecList);
      setLoading(false);
    };

    fetchData();
  }, [wardId]);

  if (loading) {
    return (
      <main style={{ padding: "24px" }}>
        <BackButton to={`/admin/ward/${wardId}`} />
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
      <BackButton to={`/admin/ward/${wardId}`} />

      {/* ★ タイトル（スマホで崩れない2行固定） */}
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
        <span style={{ display: "inline-block" }}>
          🫧 {wardNameMap[wardId]}　7日以上
        </span>
        <br />
        <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
          未入力スタッフ
        </span>
      </h1>

      {/* ★ 未入力者リスト */}
      {unrecorded.length === 0 ? (
        <div
          style={{
            background: "#cfeeee",
            padding: "20px",
            borderRadius: "16px",
            textAlign: "center",
            color: "#006b5f",
            fontSize: "18px",
          }}
        >
          ✨ 全員入力できています！
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {unrecorded.map((s) => (
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
              {/* ★ 名前行（折り返し位置を完全制御） */}
              <div
                style={{
                  fontSize: "20px",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "6px",
                  lineHeight: "1.4",
                }}
              >
                <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                  🫧 {s.name}
                </span>

                <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
                  （ID: {s.staffId}）
                </span>
              </div>

              {/* ★ 最終入力行 */}
              <div
                style={{
                  fontSize: "14px",
                  color: "#008080",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                💧 最終入力：
                {s.lastDate === "記録なし" ? "記録なし" : s.lastDate}
                {s.diffDays !== null && (
                  <span>（{s.diffDays}日前）</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
