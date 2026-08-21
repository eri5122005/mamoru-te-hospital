// ★ 部署内ランキングを作る useEffect を追加
useEffect(() => {
  if (!data || !data.records) return;

  const selectedDepartment = data.staff.wardId;  // ★ この人の部署
  const records = data.records;

  const filtered = records.filter(r => r.department === selectedDepartment);

  const map = {};

  filtered.forEach(item => {
    if (item.department !== selectedDepartment) return;  // ★ 部署絞り込み

    const staffId = item.staffId;

    if (!map[staffId]) {
      map[staffId] = {
        staffId,
        name: item.name,
        totalMl: 0
      };
    }

    map[staffId].totalMl += Number(item.ml);
  });

  const rankingArray = Object.values(map).sort(
    (a, b) => b.totalMl - a.totalMl
  );

  setRanking(rankingArray);
}, [data]);
