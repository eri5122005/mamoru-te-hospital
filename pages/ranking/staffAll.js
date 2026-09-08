"use client";

import { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function StaffAllRanking() {
  const router = useRouter();
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState([]);

  useEffect(() => {
    const load = async () => {
      // ★ staff と records を取得
      const staffSnap = await getDocs(collection(db, "staff"));
      const staffList = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const recordSnap = await getDocs(collection(db, "records"));
      const records = recordSnap.docs.map(doc => doc.data());

      const now = new Date();

      let start, end;

      if (period === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      } else if (period === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      const filtered = records.filter(r => {
        if (!r.date) return false;
        const t = r.date.toDate();
        if (period === "all") return true;
        return t >= start && t <= end;
      });

      // ★ スタッフ別集計
      const staffMap = {};

      filtered.forEach(item => {
        const id = item.staffId || "unknown";   // ← ★ 空でも集計する
        const ml = Number(item.ml) || 0;

        if (!staffMap[id]) staffMap[id] = { total: 0 };
        staffMap[id].total += ml;
      });

      // ★ staffList と結合して根拠データを付ける
      const ranking = Object.entries(staffMap)
        .map(([staffId, obj]) => {
          const staff = staffList.find(s => s.id === staffId);

          return {
            staffId,
            name: staff?.name || "テスト患者",
            department: staff?.department || staff?.wardId || "不明",
            total: obj.total,
            workDays: staff?.workDays || 1,  // ← ★ 0日でもランキングに出るように
            avg: staff?.workDays ? obj.total / staff.workDays : obj.total
          };
        })
        .sort((a, b) => b.total - a.total);

      setData(ranking);
    };

    load();
  }, [period]);

  return (
    <main style={{ padding: "20px", background: "#F9F9F9", minHeight: "100vh" }}>
      <button
        onClick={() => router.push("/ranking")}
        style={{
          background: "#cfeeee",
          color: "#006b5f",
          border: "none",
          padding: "10px 16px",
          borderRadius: "12px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "20px",
          width: "100%"
        }}
      >
        ← ランキングメニューに戻る
      </button>

      <h1
        style={{
          color: "#006b5f",
          marginBottom: "24px",
          textAlign: "center",
          fontSize: "26px",
          fontWeight: "600",
          borderBottom: "3px solid #cfeeee",
          paddingBottom: "6px"
        }}
      >
        <div style={{ display: "inline-flex", flexDirection: "row", alignItems: "flex-start", textAlign: "left" }}>
          <span style={{ fontSize: "32px", marginRight: "8px" }}>👤</span>
          <span>
            スタッフ総合<br />
            手指消毒使用量ランキング
          </span>
        </div>
      </h1>

      {data.map((item, index) => {
        let bg = "#e8f6f6";
        let border = "#cfeeee";
        let color = "#006b5f";
        let medal = "";

        if (index === 0) {
          bg = "#fff7d1";
          border = "#e6d28a";
          color = "#8c6b00";
          medal = "🥇";
        } else if (index === 1) {
          bg = "#f0f4f7";
          border = "#d0d7dd";
          color = "#5f6b78";
          medal = "🥈";
        } else if (index === 2) {
          bg = "#fbe9d9";
          border = "#e0b89b";
          color = "#8a4f2a";
          medal = "🥉";
        }

        return (
          <div
            key={index}
            style={{
              background: bg,
              padding: "16px",
              borderRadius: "12px",
              marginBottom: "12px",
              border: `1px solid ${border}`,
              color: color,
              fontSize: "18px",
              fontWeight: "600"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "24px" }}>{medal}</span>
              <span>{index + 1}位：{item.name}（{item.department}）</span>
            </div>

            <div style={{ marginTop: "8px", fontSize: "15px", color: "#555" }}>
              合計：{item.total.toFixed(2)} mL<br />
              勤務日数：{item.workDays} 日<br />
              平均：{item.avg.toFixed(2)} mL/日
            </div>
          </div>
        );
      })}
    </main>
  );
}
