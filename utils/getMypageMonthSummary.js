import { getRecordDate } from "./getRecordDate";

const japanDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
});

function getParts(date) {
  const parts = japanDate.formatToParts(date);
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function getMonthlyChallenge(days) {
  const stages = [
    { days: 5, icon: "🌱" }, { days: 10, icon: "🌿" },
    { days: 15, icon: "🍀" }, { days: 20, icon: "🏆" },
  ];
  const achieved = stages.filter((stage) => days >= stage.days).pop();
  const next = stages.find((stage) => days < stage.days);
  return {
    title: achieved ? `${achieved.icon} ${achieved.days}日達成！` : "🌱 はじめの一手",
    detail: !achieved ? `🌱 最初の「5日記録」まであと${5 - days}日`
      : next ? `次の「${next.icon} ${next.days}日」まであと${next.days - days}日`
        : `今月 ${days}日記録`,
    progress: Math.min(days / 20 * 100, 100),
  };
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
        parts.day <= previousEndDay && Number.isFinite(ml)) previousMl += ml;
  });

  return {
    recordedDays: recordedDays.size,
    challenge: getMonthlyChallenge(recordedDays.size),
    currentMl, previousMl,
    difference: Number((currentMl - previousMl).toFixed(1)),
    currentMonth: current.month, currentEndDay: current.day,
    previousMonth: previous.month, previousEndDay,
  };
}
