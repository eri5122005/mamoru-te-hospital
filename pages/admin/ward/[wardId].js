"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/firebaseConfig";
import BackButton from "@/components/BackButton";

export default function StaffList() {
  const router = useRouter();
  const { wardId } = router.query;

  const [staff, setStaff] = useState([]);
  const [wardName, setWardName] = useState("");

  // ★ Firestoreからスタッフ一覧を取得（在職者のみ）
  const fetchStaff = async () => {
    if (!wardId) return;

    const q = query(
      collection(db, "staff"),
      where("wardId", "==", wardId),
      where("isActive", "==", true) // ★ 在職者のみ表示
    );

    const querySnapshot = await getDocs(q);

    const staffList = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setStaff(staffList);
  };

  // ★ Firestoreから病棟名を取得
  const fetchWardName = async () => {
    const wardsSnapshot = await getDocs(collection(db, "wards"));
    const wards = wardsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const ward = wards.find((w) => w.id === wardId);
    setWardName(ward ? ward.name : "不明な病棟");
  };

  useEffect(() => {
    fetchStaff();
    fetchWardName();
  }, [wardId]);

  // ★ 退職処理（削除ではなく isActive:false）
  const retireStaff = async (id) => {
    await updateDoc(doc(db, "staff", id), {
      isActive: false,
    });

    await fetchStaff(); // 再読み込み
  };

  return (
    <main
      style={{
        padding: "24px",
        background: "#F9F9F9",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <BackButton to="/admin/ward" />

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px",
        }}
      >
        👥 {wardName} スタッフ一覧
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {staff.map((s) => (
          <div
            key={s.id}
            style={{
              background: "#ffffff",
              border: "1px solid #cfeeee",
              borderRadius: "16px",
              padding: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#006b5f",
            }}
          >
            <span>{s.name}</span>

            <button
              onClick={() => retireStaff(s.id)}
              style={{
                background: "#ffdddd",
                color: "#a30000",
                border: "none",
                padding: "8px 12px",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              退職
            </button>
          </div>
        ))}
      </div>

      <div
        onClick={() => router.push(`/admin/ward/${wardId}`)}
        style={{
          marginTop: "24px",
          background: "#ffffff",
          border: "1px solid #cfeeee",
          borderRadius: "16px",
          padding: "20px",
          textAlign: "center",
          cursor: "pointer",
          color: "#006b5f",
        }}
      >
        ← 部署管理メニューに戻る
      </div>
    </main>
  );
}
