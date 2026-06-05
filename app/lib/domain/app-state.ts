import type { AppState } from "@/app/types/nomcurry";
import { todayKey } from "@/app/lib/nomcurry/date";
import {
  type SheetRow,
  isDeleted,
  normalize,
  normalizeDateKey,
  parseHours,
  parseMoney,
  readObjects,
} from "@/app/lib/sheets/helpers";
import { ATTENDANCE_STATUS, SHEETS, STATUS } from "./shared";

export async function getInitialData(actorEmail: string): Promise<AppState> {
  const [employees, shifts, registrations, attendanceRows, payrollRates] = await Promise.all([
    readObjects(SHEETS.employees),
    readObjects(SHEETS.shifts),
    readObjects(SHEETS.registrations),
    readObjects(SHEETS.attendance),
    readObjects(SHEETS.payroll),
  ]);

  const email = normalize(actorEmail);
  const employee = email ? (employees.find((row) => normalize(row["Email"]) === email) ?? null) : null;
  const isManager = Boolean(employee && employee["Vai trò"] === "Quản lý");

  if (!employee) {
    return buildAppState({
      email: actorEmail,
      employee: null,
      isManager: false,
      employees: [],
      shifts,
      registrations: [],
      allRegistrations: registrations,
      attendanceRows,
      allAttendanceRows: attendanceRows,
      payrollRates,
    });
  }

  const visibleRegistrations = (isManager
    ? registrations
    : registrations.filter((row) => row["Nhân Viên"] === employee["Mã NV"])
  ).filter((row) => !isDeleted(row));

  const visibleAttendanceRows = isManager
    ? attendanceRows
    : attendanceRows.filter((row) => row["Nhân Viên"] === employee["Mã NV"]);

  const visibleEmployees = isManager ? employees : [employee];

  return buildAppState({
    email: actorEmail,
    employee,
    isManager,
    employees: visibleEmployees,
    shifts,
    registrations: visibleRegistrations,
    allRegistrations: registrations,
    attendanceRows: visibleAttendanceRows,
    allAttendanceRows: attendanceRows,
    payrollRates,
  });
}

function buildOccupiedSlots(registrations: SheetRow[]) {
  const seen = new Map<string, { dateKey: string; shiftId: string }>();
  registrations.forEach((row) => {
    if (!isDeleted(row) && row["Tình Trạng"] === STATUS.approved) {
      const dateKey = normalizeDateKey(row["Ngày"]);
      const shiftId = String(row["Ca Làm"] ?? "");
      seen.set(`${dateKey}|${shiftId}`, { dateKey, shiftId });
    }
  });
  return Array.from(seen.values());
}

function buildAttendanceItems(registrations: SheetRow[], attendanceRows: SheetRow[]) {
  const attendanceMap = new Map<string, SheetRow>();
  attendanceRows.forEach((row) => attendanceMap.set(row["Mã Đăng Ký"], row));

  return registrations
    .filter((row) => row["Tình Trạng"] === STATUS.approved)
    .map((reg) => {
      const att = attendanceMap.get(reg["Mã Đăng Ký"]) ?? null;
      return {
        registrationId: reg["Mã Đăng Ký"],
        date: reg["Ngày"],
        shiftId: reg["Ca Làm"],
        employeeId: reg["Nhân Viên"],
        note: reg["Ghi chú"],
        checkInAt: att?.["Giờ vào"] ?? "",
        checkOutAt: att?.["Giờ ra"] ?? "",
        workedHours: att ? parseHours(att["Số giờ"]) : 0,
        status: att?.["Trạng thái"] ?? ATTENDANCE_STATUS.notCheckedIn,
        attendanceNote: att?.["Ghi chú"] ?? "",
      };
    });
}

function buildPayrollSummary(employees: SheetRow[], attendanceRows: SheetRow[], payrollRates: SheetRow[]) {
  const rateMap = new Map<string, number>();
  payrollRates.forEach((row) => rateMap.set(row["Mã NV"], parseMoney(row["Lương/Giờ"])));

  return employees.map((emp) => {
    const completed = attendanceRows.filter(
      (row) => row["Nhân Viên"] === emp["Mã NV"] && row["Trạng thái"] === ATTENDANCE_STATUS.completed
    );
    const totalHours = completed.reduce((sum, row) => sum + parseHours(row["Số giờ"]), 0);
    const hourlyRate = rateMap.get(emp["Mã NV"]) ?? 0;
    return {
      employeeId: emp["Mã NV"],
      employeeName: emp["Tên NV"],
      email: emp["Email"],
      role: emp["Vai trò"],
      approvedShifts: completed.length,
      totalHours,
      hourlyRate,
      totalPay: totalHours * hourlyRate,
    };
  });
}

function buildDashboard(
  employees: SheetRow[],
  shifts: SheetRow[],
  registrations: SheetRow[],
  attendanceRows: SheetRow[],
  payrollSummary: ReturnType<typeof buildPayrollSummary>
) {
  const appTodayKey = todayKey();
  const inProgress = attendanceRows.filter((r) => r["Trạng thái"] === ATTENDANCE_STATUS.inProgress);
  const completed = attendanceRows.filter((r) => r["Trạng thái"] === ATTENDANCE_STATUS.completed);
  const pending = registrations.filter((r) => r["Tình Trạng"] === STATUS.pending);
  const todayRows = registrations.filter((r) => normalizeDateKey(r["Ngày"]) === appTodayKey);

  return {
    employeeCount: employees.length,
    shiftCount: shifts.length,
    totalRegistrations: registrations.length,
    pendingCount: pending.length,
    approvedCount: registrations.filter((r) => r["Tình Trạng"] === STATUS.approved).length,
    rejectedCount: registrations.filter((r) => r["Tình Trạng"] === STATUS.rejected).length,
    inProgressCount: inProgress.length,
    completedAttendanceCount: completed.length,
    todayCount: todayRows.length,
    totalHours: payrollSummary.reduce((s, r) => s + r.totalHours, 0),
    totalPay: payrollSummary.reduce((s, r) => s + r.totalPay, 0),
  };
}

type BuildAppStateInput = {
  email: string;
  employee: SheetRow | null;
  isManager: boolean;
  employees: SheetRow[];
  shifts: SheetRow[];
  registrations: SheetRow[];
  allRegistrations: SheetRow[];
  attendanceRows: SheetRow[];
  allAttendanceRows: SheetRow[];
  payrollRates: SheetRow[];
};

function buildAppState(input: BuildAppStateInput): AppState {
  const payrollSummary = buildPayrollSummary(input.employees, input.allAttendanceRows, input.payrollRates);
  const attendanceItems = buildAttendanceItems(input.registrations, input.attendanceRows);

  return {
    email: input.email,
    employee: input.employee,
    isManager: input.isManager,
    employees: input.employees,
    shifts: input.shifts,
    registrations: input.registrations,
    attendanceItems,
    occupiedSlots: buildOccupiedSlots(input.allRegistrations),
    payrollSummary,
    dashboard: buildDashboard(input.employees, input.shifts, input.allRegistrations, input.allAttendanceRows, payrollSummary),
  };
}
