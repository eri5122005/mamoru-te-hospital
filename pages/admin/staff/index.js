"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";

// Firestore
import { db } from "../../../firebaseConfig";
import { collection, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";

export default function StaffManagePage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [loading, setLoading] = useState(true);

  // ★ Firestore から wards を読み込む（あなたのデータ構造に合わせた完成版）
  const loadWards = async () => {
    const snapshot = await getDocs(collection(db, "wards"));
    const list = snapshot.docs.map((d) => ({
      wardId: d.data().wardId,   // ★ Firestore の wardId を使う
      name: d.data().name,
      order: d.data().order,
    }));
    setWards(list);
  };

  // ★ Firestore から staff を読み込む
  const loadStaff = async () => {
    try {
      const snapshot = await getDocs(collection(db, "staff"));
      const list = snapshot.docs.map((d) => d.data());
      setStaffList(list);
    } catch (error) {
      console.error("Firestore エラー:", error);
      alert("スタッフ一覧の取得に失敗しました");
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadWards();
      await loadStaff();
      setLoading(false);
    };
    init();
  }, []);

  if (loading) {
    return <AdminLayout>読み込み中...</AdminLayout>;
  }

  // 退職処理
  const retireStaff = async () => {
    if (!selectedStaffId) return;

    await updateDoc(doc(db, "staff", String(selectedStaffId)), {
      isActive: false,
    });

    alert("退職処理が完了しました");
    location.reload();
  };

  // 完全削除
  const deleteStaff = async () => {
    if (!selectedStaffId) return;

    await deleteDoc(doc(db, "staff", String(selectedStaffId)));

    alert("スタッフを削除しました");
    location.reload();
  };

  // 部署ごとにグループ化（wardId でグループ化）
  const grouped = staffList.reduce((acc, s) => {
    const ward = s.wardId || "不明";
    acc[ward] = acc[ward] || [];
    acc[ward].push(s);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <h1 style={{ textAlign: "center", color: "#006b5f", marginBottom: "24px" }}>
        👥 スタッフ管理
      </h1>

      {/* スタッフ追加 */}
      <button
        onClick={() => router.push("/admin/staff/add")}
        style={{
          background: "#006b5f",
          color: "white",
          padding: "12px 20px",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          marginBottom: "24px",
        }}
      >
        ➕ スタッフを追加する
      </button>

      {/* 部署ごとに表示 */}
      {Object.keys(grouped).map((wardId) => {
        const wardName = wards.find((w) => w.wardId === wardId)?.name || "不明";

        return (
          <div
            key={wardId}
            style={{
              background: "#e8f6f6",
              padding: "20px",
              borderRadius: "16px",
              marginBottom: "24px",
            }}
          >
            <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>
              🏥 {wardName}
            </h2>

            {grouped[wardId].map((s) => (
              <div
                key={s.staffId}
                onClick={() => setSelectedStaffId(s.staffId)}
                style={{
                  background: selectedStaffId === s.staffId ? "#dff4f4" : "white",
                  border: "1px solid #cfeeee",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <span>
                  {s.name}（ID: {s.staffId}）／勤務日数: {s.workDays}
                </span>
              </div>
            ))}
          </div>
        );
      })}

      {/* ★ 選択したスタッフに対する操作ボタン */}
      {selectedStaffId && (
        <div
          style={{
            marginTop: "24px",
            padding: "20px",
            background: "#ffffff",
            border: "1px solid #cfeeee",
            borderRadius: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ marginBottom: "12px", color: "#006b5f" }}>
            選択中のスタッフ ID: {selectedStaffId}
          </p>

          <button
            onClick={retireStaff}
            style={{
              background: "#ffe7c4",
              color: "#a35b00",
              border: "none",
              padding: "10px 16px",
              borderRadius: "10px",
              cursor: "pointer",
              marginRight: "12px",
            }}
          >
            退職
          </button>

          <button
            onClick={deleteStaff}
            style={{
              background: "#ffdddd",
              color: "#a30000",
              border: "none",
              padding: "10px 16px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            削除
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
