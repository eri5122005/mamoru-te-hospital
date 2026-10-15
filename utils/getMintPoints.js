import { getRecordDate } from "./getRecordDate.js";

const japanDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
});

export function getMintDateKey(value) {
  const date = getRecordDate(value);
  if (!date) return null;
  const parts = japanDate.formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

// Pass one staff member's records. Stored mintPoint and usage never affect points.
export function getMintPoints(records, period = "all", now = new Date()) {
  const currentKey = getMintDateKey(now);
  const days = new Set();
  records.forEach((record) => {
    const key = getMintDateKey(record.date);
    if (!key) return;
    if (period === "today" && key !== currentKey) return;
    if (period === "month" && key.slice(0, 7) !== currentKey?.slice(0, 7)) return;
    if (period === "year" && key.slice(0, 4) !== currentKey?.slice(0, 4)) return;
    days.add(key);
  });
  return days.size;
}

export function getMintRanking(records, period = "all", now = new Date()) {
  const groups = Object.create(null);
  records.forEach((record) => {
    if (record.staffId === undefined || record.staffId === null || record.staffId === "") return;
    if (getMintPoints([record], period, now) === 0) return;
    const id = record.staffId;
    if (!groups[id]) groups[id] = [];
    groups[id].push(record);
  });
  return Object.values(groups).map((staffRecords) => {
    const first = staffRecords[0];
    return {
      staffId: first.staffId,
      name: first.name,
      department: first.wardId,
      mintPoint: getMintPoints(staffRecords, period, now),
    };
  }).filter((item) => item.mintPoint > 0)
    .sort((a, b) => b.mintPoint - a.mintPoint);
}
