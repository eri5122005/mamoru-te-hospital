import { normalizeStaffId } from "./normalizeStaffId";
import { getWorkDays } from "./getWorkDays";

export const staffDepartments = {
  "4f": "4階",
  "5f": "5階",
  "6f": "6階",
  "78f": "7.8階",
  gairai: "外来",
  touseki: "透析室",
  riha: "リハビリ",
  shisetsu: "施設管理",
  ikyoku: "医局",
  nursing: "看護部",
};

// IDs explicitly handled as administrators by pages/login/index.js.
const reservedIds = new Set([
  "9999", "2100", "2150", "2200", "2201", "2300", "2305", "2400",
  "2444", "2500", "2555", "2600", "2666", "2700", "2777", "2900",
]);

export function validateStaffRegistration(input) {
  if (typeof input?.staffId !== "string") return { error: "職員番号を入力してください。" };
  const staffId = normalizeStaffId(input.staffId);
  if (!staffId || staffId.includes("/") || staffId === "." || staffId === "..") {
    return { error: "有効な職員番号を入力してください。" };
  }
  if (reservedIds.has(staffId)) return { error: "この職員番号は管理者用のため登録できません。" };
  if (typeof input.name !== "string" || !input.name.trim()) return { error: "氏名を入力してください。" };
  if (typeof input.wardId !== "string" || !Object.hasOwn(staffDepartments, input.wardId)) {
    return { error: "部署を選択してください。" };
  }
  const workDays = getWorkDays(input.workDays);
  if (workDays === null) return { error: "勤務日数は1以上の整数で入力してください。" };
  return { data: {
    staffId, name: input.name.trim(), wardId: input.wardId,
    department: staffDepartments[input.wardId], workDays,
    role: "staff", isActive: true, mode: "weight", lastWeight: null, emptyWeight: null,
  } };
}
