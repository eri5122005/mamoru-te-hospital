"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecordDate } from "@/utils/getRecordDate";
import { useRouter } from "next/navigation";
import NavBar from "../../components/NavBar";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function HistoryPage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const current = JSON.parse(localStorage.getItem("currentStaff"));
    if (!current) {
      router.replace("/login");
      return;
    }
    setStaff(current);

    // ★ Firestore から自分の履歴だけ取得
    const load = async () => {
      const q = query(
        collection(db, "records"),
        where("staffId", "==", current.staffId)
      );

      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, date: getRecordDate(data.date) };
      });

      // 新しい順。不正・未設定の日付は末尾に表示する。
      list.sort((a, b) =>
        (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity)
      );
      setRecords(list);

    };

    load();
  }, []);

  if (!staff) return <p>読み込み中…</p>;

  return (
    <main
      style={{
        background: "#F9F9F9",
        minHeight: "100vh",
        padding: "24px",
        fontFamily: "sans-serif",
        maxWidth: "480px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/mypage"
        style={{
          display: "block",
          textAlign: "center",
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          marginBottom: "20px",
          cursor: "pointer",
          width: "100%",
        }}
      >
        ← マイページへ戻る
      </Link>

      <h1 style={{ color: "#006b5f", marginBottom: "20px" }}>履歴</h1>

      <p style={{ color: "#006b5f", marginBottom: "16px", fontSize: "18px" }}>
        👤 {staff.name} さんの履歴
      </p>

      {records.length === 0 && (
        <p style={{ color: "#006b5f" }}>まだ記録がありません。</p>
      )}

      {records.map((item) => (
        <div
          key={item.id}
          style={{
            background: "#ffffff",
            border: "1px solid #cfeeee",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            color: "#006b5f",
          }}
        >
          {item.date ? item.date.toLocaleString("ja-JP") : "日付不明"} / {Number(item.ml).toFixed(2)} mL
        </div>
      ))}

      <NavBar />
    </main>
  );
}
