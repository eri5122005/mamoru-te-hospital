import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";

// ★ Firestore
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function StaffSettings() {
  const router = useRouter();

  const [staffList, setStaffList] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    const savedWards = JSON.parse(localStorage.getItem("wards") || "[]");
    setWards(savedWards);

    // ★ Firestore からスタッフ一覧を取得
    const fetchStaff = async () => {
      const snapshot = await getDocs(collection(db, "staff"));
      const list = snapshot.docs.map((doc) => doc.data());
      setStaffList(list);
    };

    fetchStaff();
  }, []);

  return (
    <main style={{ padding: "24px", background: "#F9F9F9", minHeight: "100vh" }}>
      <BackButton to="/admin/settings" />

      <h1 style={{ color: "#006b5f", marginBottom: "24px", textAlign: "center" }}>
        👥 スタッフ設定
      </h1>

      <button
        onClick={() => router.push("/admin/settings/staff/add")}
        style={{
          marginBottom: "24px",
          padding: "12px",
          background: "#006b5f",
          color: "white",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
        }}
      >
        ➕ スタッフを追加する
      </button>

      <h2 style={{ color: "#006b5f", marginBottom: "12px" }}>スタッフ一覧</h2>

      {staffList.length === 0 ? (
        <p>スタッフが登録されていません</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {staffList.map((s) => (
            <div
              key={s.staffId}
              style={{
                background: "white",
                border: "1px solid #cfeeee",
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#006b5f",
              }}
            >
              <span>
                {s.name}（ID: {s.staffId}） /{" "}
                {wards.find((w) => w.id === s.wardId)?.name} / {s.workDays}
              </span>

              <button
                onClick={() => router.push(`/admin/settings/staff/${s.staffId}`)}
                style={{
                  background: "#00a68c",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  cursor: "pointer",
                }}
              >
                編集
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
