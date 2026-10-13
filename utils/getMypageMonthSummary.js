import { getRecordDate } from "./getRecordDate";

const japanDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
});

function getParts(date) {
  const parts = japanDate.formatToParts(date);
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function getMypageUsageTrend(records, now = new Date()) {
  const current = getParts(now);
  const monthlyRecords = records.map((record) => ({
    date: getRecordDate(record.date), ml: Number(record.ml ?? 0),
  })).filter(({ date, ml }) => {
    if (!date || !Number.isFinite(ml)) return false;
    const parts = getParts(date);
    return parts.year === current.year && parts.month === current.month;
  }).sort((a, b) => a.date.getTime() - b.date.getTime());

  const points = [];
  let cumulativeMl = 0;
  monthlyRecords.forEach(({ date, ml }) => {
    cumulativeMl += ml;
    const { month, day } = getParts(date);
    const label = `${month}/${day}`;
    if (points.length && points[points.length - 1].label === label) {
      points[points.length - 1].ml = cumulativeMl;
    } else {
      points.push({ label, ml: cumulativeMl });
    }
  });
  return points;
}

export function getMonthlyInputStatus(recordedDays, workDays) {
  const value = typeof workDays === "number" ||
    (typeof workDays === "string" && workDays.trim()) ? Number(workDays) : NaN;
  if (!Number.isInteger(value) || value <= 0) {
    return { workDays: null, rate: null };
  }
  return { workDays: value, rate: Math.min(100, Math.round(recordedDays / value * 100)) };
}

export function getMypageMonthSummary(records, now = new Date()) {
  const current = getParts(now);
  // UTC calendar arithmetic avoids host timezone/DST and handles January/leap years.
  const previousDate = new Date(Date.UTC(current.year, current.month - 2, 1));
  const previous = { year: previousDate.getUTCFullYear(), month: previousDate.getUTCMonth() + 1 };
  const previousMonthDays = new Date(Date.UTC(current.year, current.month - 1, 0)).getUTCDate();
  const previousEndDay = Math.min(current.day, previousMonthDays);
  const recordedDays = new Set();
  let currentMl = 0;
  let previousMl = 0;
  let previousRecordCount = 0;

  records.forEach((record) => {
    const date = getRecordDate(record.date);
    if (!date) return;
    const parts = getParts(date);
    const ml = Number(record.ml ?? 0);
    if (parts.year === current.year && parts.month === current.month) {
      recordedDays.add(parts.day); // Includes zero-usage records and counts each day once.
      if (parts.day <= current.day && Number.isFinite(ml)) currentMl += ml;
    }
    if (parts.year === previous.year && parts.month === previous.month &&
        parts.day <= previousEndDay) {
      previousRecordCount += 1;
      if (Number.isFinite(ml)) previousMl += ml;
    }
  });

  return {
    recordedDays: recordedDays.size,
    currentMl, previousMl, previousRecordCount,
    difference: Number((currentMl - previousMl).toFixed(1)),
    currentMonth: current.month, currentEndDay: current.day,
    previousMonth: previous.month, previousEndDay,
  };
}
