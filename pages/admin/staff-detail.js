"use client";

import { useEffect, useState } from "react";

export default function StaffDetailPage() {
  const [data, setData] = useState(null);
  const [ranking, setRanking] = useState([]);

  // ★ URL から staffId を取得
  const staffId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("id")
      : null;

  // ★ API からスタッフ詳細を取得
  useEffect(() => {
    if (!staffId) return;

    const fetchData = async () => {
      const res = await fetch(`/api/admin/staff-detail?id=${staffId}`);
      const json = await res.json();
      setData(json);
    };

    fetchData();
  }, [staffId]);

  // ★ 部署内ランキングを作成
  useEffect(() => {
    if (!data || !data.records) return;

    const selectedDepartment = data.staff.wardId;
    const records = data.records;

    const filtered = records.filter(
      (r) => r.department === selectedDepartment
    );

    const map = {};

    filtered.forEach((item) => {
      const staffId = item.staffId;

      if (!map[staffId]) {
        map[staffId] = {
          staffId,
          name: item.name,
          totalMl: 0,
        };
      }

      map[staffId].totalMl += Number(item.ml);
    });

    const rankingArray = Object.values(map).sort(
      (a, b) => b.totalMl - a.totalMl
    );

    setRanking(rankingArray);
  }, [data]);

  if (!data) {
    return <p>読み込み中…</p>;
  }

  return (
    <main style={{ padding: "20px" }}>
      <h1>{data.staff.name} さんの詳細</h1>

      <h2>部署内ランキング</h2>
      {ranking.map((item, index) => (
        <div key={index}>
          {index + 1}位：{item.name}（{item.totalMl} mL）
        </div>
      ))}

      <h2>今月の記録</h2>
      {data.records.map((r) => (
        <div key={r.recordId}>
          {r.date}：{r.ml} mL
        </div>
      ))}
    </main>
  );
}
