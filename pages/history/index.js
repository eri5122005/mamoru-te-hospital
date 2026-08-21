"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "../../components/NavBar";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function HistoryPage() {
  const router = useRouter();
  const [staff, setStaff] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

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
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setRecords(list);
    };

    load();
  }, []);

  // ★ Firestore 削除処理
  const handleDelete = async () => {
    if (!selectedRecord) return;

    await deleteDoc(doc(db, "records", selectedRecord));

    // ★ ミントポイント減らす
    const mint = Number(localStorage.getItem("mintPoint") || 0);
    localStorage.setItem("mintPoint", Math.max(0, mint - 1));

    // ★ 記録回数減らす
    const count = Number(localStorage.getItem("historyCount") || 0);
    localStorage.setItem("historyCount", Math.max(0, count - 1));

    // ★ 画面更新
    setRecords(records.filter(r => r.id !== selectedRecord));
    setSelectedRecord(null);
  };

  const handleEdit = () => {
    if (!selectedRecord) return;
    router.push(`/history/edit?id=${selectedRecord}`);
  };

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
          onClick={() => setSelectedRecord(item.id)}
          style={{
            background: selectedRecord === item.id ? "#e8f6f6" : "#ffffff",
            border: "1px solid #cfeeee",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            cursor: "pointer",
            color: "#006b5f",
          }}
        >
          {item.date.toDate().toLocaleString()} / {item.ml} mL
        </div>
      ))}

      {selectedRecord && (
        <>
          <button
            onClick={handleEdit}
            style={{
              background: "#cfeeee",
              color: "#006b5f",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              width: "100%",
              marginTop: "10px",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            選択した記録を修正する
          </button>

          <button
            onClick={handleDelete}
            style={{
              background: "#ffdddd",
              color: "#a30000",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              width: "100%",
              marginTop: "10px",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            選択した記録を削除する
          </button>
        </>
      )}
{staff.role === "admin" && (
  <button
    onClick={async () => {
      const current = JSON.parse(localStorage.getItem("currentStaff"));
      if (!current) return;

      const q = query(
        collection(db, "records"),
        where("wardId", "==", current.wardId)
      );

      const snap = await getDocs(q);

      let deleteCount = 0;

      for (const d of snap.docs) {
        const data = d.data();

        if (!data.name || data.name.trim() === "") {
          await deleteDoc(doc(db, "records", d.id));
          deleteCount++;
        }
      }

      alert(`名前未登録の記録を ${deleteCount} 件削除しました`);

      router.refresh();
    }}
    style={{
      background: "#ffecec",
      color: "#a30000",
      padding: "14px",
      borderRadius: "12px",
      border: "none",
      width: "100%",
      marginTop: "20px",
      fontSize: "18px",
      cursor: "pointer",
    }}
  >
    名前未登録の記録を削除する（総合管理者専用）
  </button>
)}

      <NavBar />
    </main>
  );
}
