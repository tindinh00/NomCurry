import { getWeekMonday, normalizeDateKey } from "@/app/lib/nomcurry/date";
import type { AppRoute, AppState, SheetRow } from "@/app/types/nomcurry";

export function normalizeRoute(route: AppRoute, state: AppState): AppRoute {
  if (!state.employee) return "auth";
  if (route === "auth") return state.isManager ? "dashboard" : "shifts";
  if (!state.isManager && ["dashboard", "payroll", "approve"].includes(route)) return "shifts";
  if (state.isManager && ["shifts", "attendance", "auth"].includes(route)) return "dashboard";
  return route;
}

export function findShift(state: AppState, id: string) {
  return state.shifts.find((item) => item["Mã Ca"] === id);
}

export function findEmployee(state: AppState, id: string) {
  return state.employees.find((item) => item["Mã NV"] === id);
}

export function registrationHaystack(state: AppState, row: SheetRow) {
  const shift = findShift(state, row["Ca Làm"]);
  const employee = findEmployee(state, row["Nhân Viên"]);

  return [
    normalizeDateKey(row["Ngày"]),
    row["Ca Làm"],
    shift?.["Tên Ca"],
    row["Nhân Viên"],
    employee?.["Tên NV"],
    row["Ghi chú"],
    row["Tình Trạng"],
  ].join(" ").toLowerCase();
}

export function groupRegistrationsByWeek(rows: SheetRow[]) {
  const map = new Map<string, SheetRow[]>();

  rows.forEach((row) => {
    const key = getWeekMonday(row["Ngày"]);
    map.set(key, [...(map.get(key) || []), row]);
  });

  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).map(([weekKey, groupRows]) => ({
    weekKey,
    rows: groupRows,
  }));
}

export function sortRegistrationsNewest(a: SheetRow, b: SheetRow) {
  return normalizeDateKey(b["Ngày"]).localeCompare(normalizeDateKey(a["Ngày"]))
    || String(b["Mã Đăng Ký"]).localeCompare(String(a["Mã Đăng Ký"]))
    || String(b["Ca Làm"]).localeCompare(String(a["Ca Làm"]));
}

export function getAvatarFallback(state: AppState | null) {
  const name = state?.employee?.["Tên NV"];
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1]?.charAt(0).toUpperCase() || "?";
  }

  return state?.email?.charAt(0).toUpperCase() || "?";
}
