"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function StaffRanking() {
  const router = useRouter();
  const { staffId } = useParams();

  const [staff, setStaff] = useState(null);
  const [records, setRecords] = useState([]);
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");
    const history = JSON.parse(localStorage.getItem("history") || "[]");

    const me = staffList.find(s => s.staffId === staffId);
    setStaff(me);

    // ★ 自分の部署だけの記録に絞る
    const filtered = history.filter(r => r.department === me.department);

    setRecords(filtered);
  }, [staffId]);

  useEffect(() => {
    if (!staff || records.length === 0) return;

    const map = {};

    records.forEach(item => {
      if (!map[item.staffId]) {
        map[item.staffId] = {
          staffId: item.staffId,
          name: item.name,
          department: item.department,
          totalMl: 0
        };
      }
      map[item.staffId].totalMl += Number(item.ml);
    });

    const sorted = Object.values(map).sort(
      (a, b) => b.totalMl - a.totalMl
    );

    setRanking(sorted);
  }, [staff, records]);

  if (!staff) return <div>読み込み中...</div>;

  return (
    <main style={{ padding: "20px" }}>
      <h1>{staff.name} さんの部署内ランキング</h1>
      <p>部署：{staff.department}</p>

      {ranking.map((item, index) => (
        <div key={item.staffId}>
          {index + 1} 位：{item.name}（{item.totalMl} mL）
        </div>
      ))}
    </main>
  );
}
