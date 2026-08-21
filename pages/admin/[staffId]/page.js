"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function StaffRankingPage() {
  const { staffId } = useParams();
  const [staff, setStaff] = useState(null);
  const [ranking, setRanking] = useState([]);

  useEffect(() => {
    const staffList = JSON.parse(localStorage.getItem("staffList") || "[]");
    const history = JSON.parse(localStorage.getItem("history") || "[]");

    // ★ 自分のスタッフ情報を取得
    const me = staffList.find(s => s.staffId === staffId);
    if (!me) return;

    setStaff(me);

    // ★ 部署絞り込み（ここが本命）
    const filtered = history.filter(r => r.department === me.department);

    // ★ 部署内ランキング計算
    const map = {};
    filtered.forEach(item => {
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
  }, [staffId]);

  if (!staff) return <p>読み込み中…</p>;

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
