export const APP_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const APP_UTC_OFFSET = "+07:00";

export function normalizeDateKey(value: string) {
  const date = String(value || "").trim();
  const iso = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const slash = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;

  return date;
}

export function todayKey() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function currentMonthKey() {
  return todayKey().slice(0, 7);
}

export function appDateTime(dateStr: string, hour: number, minute: number) {
  const dateKey = normalizeDateKey(dateStr);
  return new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${APP_UTC_OFFSET}`
  );
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getWeekMonday(dateStr: string) {
  const [year, month, dayOfMonth] = normalizeDateKey(dateStr).split("-").map(Number);
  const date = new Date(year, month - 1, dayOfMonth);
  const day = date.getDay();
  date.setDate(date.getDate() - ((day + 6) % 7));
  return formatDateKey(date);
}

export function getWeekDays(monday: string) {
  const [year, month, dayOfMonth] = monday.split("-").map(Number);
  const date = new Date(year, month - 1, dayOfMonth);

  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(date);
    next.setDate(date.getDate() + index);
    return formatDateKey(next);
  });
}

export function shiftWeek(monday: string, delta: number) {
  const [year, month, dayOfMonth] = monday.split("-").map(Number);
  const date = new Date(year, month - 1, dayOfMonth);
  date.setDate(date.getDate() + delta * 7);
  return formatDateKey(date);
}

export function getWeekLabel(mondayStr: string) {
  const days = getWeekDays(mondayStr);
  return `${formatShortDate(days[0])} - ${formatShortDate(days[6])}`;
}

export function getDayLabel(dateStr: string) {
  const [year, month, dayOfMonth] = normalizeDateKey(dateStr).split("-").map(Number);
  return ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][
    new Date(year, month - 1, dayOfMonth).getDay()
  ];
}

function formatShortDate(value: string) {
  const [, month, dayOfMonth] = value.split("-");
  return `${dayOfMonth}/${month}`;
}

