import type { AppState } from "@/app/types/nomcurry";
import { getSheetsClient, getSpreadsheetId } from "./client";
import {
  type SheetRow,
  appendObjects,
  calculateWorkedHours,
  generateId,
  isDeleted,
  normalize,
  normalizeDateKey,
  parseMoney,
  parseHours,
  readObjects,
  timestamp,
  updateByKey,
} from "./helpers";

const SHEETS = {
  employees: "NhanVien",
  shifts: "DanhMucCa",
  registrations: "DangKyCa",
  payroll: "BangLuong",
  attendance: "ChamCong",
} as const;

const STATUS = {
  pending: "Chờ duyệt",
  approved: "Đã chốt",
  rejected: "Từ chối",
} as const;

const ATTENDANCE_STATUS = {
  inProgress: "Đang làm",
  completed: "Đã kết ca",
  notCheckedIn: "Chưa điểm danh",
} as const;

// ─────────────────────────────────────────────
// Initial Data
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

export async function registerUser(actorEmail: string, name: string): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const existing = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (existing) return getInitialData(actorEmail);

  const ids = new Set(employees.map((e) => e["Mã NV"]).filter(Boolean));
  let employeeId = generateId("EMP");
  while (ids.has(employeeId)) employeeId = generateId("EMP");

  await appendObjects(SHEETS.employees, [{
    "Mã NV": employeeId,
    "Tên NV": name.trim(),
    "Email": actorEmail,
    "Vai trò": "Nhân viên",
  }]);

  // Ensure payroll row
  const payrollRows = await readObjects(SHEETS.payroll);
  const hasPay = payrollRows.some((r) => r["Mã NV"] === employeeId);
  if (!hasPay) {
    await appendObjects(SHEETS.payroll, [{ "Mã NV": employeeId, "Lương/Giờ": "0", "Ghi chú": "", "Cập nhật": "" }]);
  }

  return getInitialData(actorEmail);
}

// ─────────────────────────────────────────────
// Registrations
// ─────────────────────────────────────────────

export async function addWeeklyRegistrations(
  actorEmail: string,
  monday: string,
  slots: { date: string; shiftId: string; note: string }[],
  note: string
): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const employee = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!employee) throw new Error("Email đăng nhập chưa có trong bảng NhanVien: " + actorEmail);

  const registrations = await readObjects(SHEETS.registrations);

  // Normalize and deduplicate
  const normalizedSlots = slots
    .map((s) => ({ date: normalizeDateKey(s.date), shiftId: String(s.shiftId).trim(), note: String(s.note || note).trim() }))
    .filter((s) => s.date && s.shiftId);

  const uniqueMap = new Map<string, typeof normalizedSlots[0]>();
  normalizedSlots.forEach((s) => uniqueMap.set(`${s.date}|${s.shiftId}`, s));
  const uniqueSlots = Array.from(uniqueMap.values());

  if (!uniqueSlots.length && !monday) throw new Error("Vui lòng chọn ít nhất một ca làm trong tuần.");

  // Check for already approved/pending occupied slots
  const occupied = uniqueSlots.filter((s) => {
    const key = `${normalizeDateKey(s.date)}|${s.shiftId}`;
    return registrations.some(
      (row) => !isDeleted(row) && row["Tình Trạng"] === STATUS.approved &&
        `${normalizeDateKey(row["Ngày"])}|${row["Ca Làm"]}` === key
    );
  });
  if (occupied.length) {
    throw new Error(`Có ${occupied.length} ca đã được chốt. Vui lòng tải lại và chọn lại ca còn trống.`);
  }

  // Soft delete existing pending for this week
  await softDeletePendingForWeek(employee["Mã NV"], monday || uniqueSlots[0]?.date || "");

  if (uniqueSlots.length > 0) {
    const newRows = uniqueSlots.map((s) => ({
      "Mã Đăng Ký": generateId("REG"),
      "Ngày": s.date,
      "Ca Làm": s.shiftId,
      "Nhân Viên": employee["Mã NV"],
      "Tình Trạng": STATUS.pending,
      "Ghi chú": s.note,
      "IsDelete": "FALSE",
    }));
    await appendObjects(SHEETS.registrations, newRows);
  }

  return getInitialData(actorEmail);
}

export async function updateRegistrationStatus(
  actorEmail: string,
  registrationId: string,
  status: string
): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw new Error("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] !== "Quản lý") throw new Error("Chỉ quản lý mới được duyệt hoặc hủy ca.");

  const allowed = [STATUS.approved, STATUS.rejected];
  if (!allowed.includes(status as typeof STATUS.approved)) throw new Error("Trạng thái không hợp lệ.");

  const registrations = await readObjects(SHEETS.registrations);
  const current = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!current) throw new Error("Không tìm thấy đăng ký: " + registrationId);
  if (current["Tình Trạng"] !== STATUS.pending) {
    throw new Error(`Ca này đã được ${current["Tình Trạng"].toLowerCase()} và không thể thay đổi nữa.`);
  }

  await updateByKey(SHEETS.registrations, "Mã Đăng Ký", registrationId, { "Tình Trạng": status });
  return getInitialData(actorEmail);
}

export async function approveWeekPending(actorEmail: string, mondayStr: string): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw new Error("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] !== "Quản lý") throw new Error("Chỉ quản lý mới được duyệt ca hàng loạt.");

  const parts = mondayStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) throw new Error("Ngày không hợp lệ: " + mondayStr);

  const monday = new Date(parts[0], parts[1] - 1, parts[2]);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const registrations = await readObjects(SHEETS.registrations);
  const toApprove = registrations.filter((row) => {
    if (row["Tình Trạng"] !== STATUS.pending) return false;
    const d = parseDateKey(normalizeDateKey(row["Ngày"]));
    return d && d >= monday && d <= sunday;
  });

  if (!toApprove.length) throw new Error("Không có ca nào đang chờ duyệt trong tuần này.");

  await Promise.all(
    toApprove.map((row) =>
      updateByKey(SHEETS.registrations, "Mã Đăng Ký", row["Mã Đăng Ký"], { "Tình Trạng": STATUS.approved })
    )
  );

  return getInitialData(actorEmail);
}

export async function deleteRegistration(actorEmail: string, registrationId: string): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw new Error("Email đăng nhập chưa có trong bảng NhanVien.");

  const registrations = await readObjects(SHEETS.registrations);
  const reg = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!reg) throw new Error("Không tìm thấy đăng ký: " + registrationId);
  if (isDeleted(reg)) throw new Error("Đăng ký này đã bị xóa.");

  if (actor["Vai trò"] !== "Quản lý") {
    if (reg["Nhân Viên"] !== actor["Mã NV"]) throw new Error("Bạn không có quyền xóa đăng ký này.");
    if (reg["Tình Trạng"] !== STATUS.pending) throw new Error("Chỉ có thể hủy ca đang ở trạng thái Chờ duyệt.");
  }

  await updateByKey(SHEETS.registrations, "Mã Đăng Ký", registrationId, { "IsDelete": "TRUE" });
  return getInitialData(actorEmail);
}

// ─────────────────────────────────────────────
// Attendance
// ─────────────────────────────────────────────

export async function checkIn(actorEmail: string, registrationId: string): Promise<AppState> {
  const [employees, registrations, attendanceRows] = await Promise.all([
    readObjects(SHEETS.employees),
    readObjects(SHEETS.registrations),
    readObjects(SHEETS.attendance),
  ]);

  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw new Error("Email đăng nhập chưa có trong bảng NhanVien.");

  const reg = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!reg) throw new Error("Không tìm thấy ca đăng ký.");
  if (reg["Tình Trạng"] !== STATUS.approved) throw new Error("Chỉ ca đã được duyệt mới được điểm danh.");
  if (actor["Vai trò"] !== "Quản lý" && reg["Nhân Viên"] !== actor["Mã NV"]) {
    throw new Error("Bạn không có quyền điểm danh ca của nhân viên khác.");
  }

  const existing = attendanceRows.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (existing?.["Trạng thái"] === ATTENDANCE_STATUS.completed) throw new Error("Ca này đã kết ca, không thể điểm danh lại.");
  if (existing?.["Trạng thái"] === ATTENDANCE_STATUS.inProgress) throw new Error("Ca này đã được điểm danh.");

  await appendObjects(SHEETS.attendance, [{
    "Mã Chấm Công": generateId("ATT"),
    "Mã Đăng Ký": registrationId,
    "Ngày": reg["Ngày"],
    "Ca Làm": reg["Ca Làm"],
    "Nhân Viên": reg["Nhân Viên"],
    "Giờ vào": timestamp(),
    "Giờ ra": "",
    "Số giờ": "",
    "Trạng thái": ATTENDANCE_STATUS.inProgress,
    "Ghi chú": "",
  }]);

  return getInitialData(actorEmail);
}

export async function checkOut(actorEmail: string, registrationId: string, note: string): Promise<AppState> {
  const [employees, registrations, attendanceRows] = await Promise.all([
    readObjects(SHEETS.employees),
    readObjects(SHEETS.registrations),
    readObjects(SHEETS.attendance),
  ]);

  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw new Error("Email đăng nhập chưa có trong bảng NhanVien.");

  const reg = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!reg) throw new Error("Không tìm thấy ca đăng ký.");
  if (reg["Tình Trạng"] !== STATUS.approved) throw new Error("Chỉ ca đã được duyệt mới được kết ca.");
  if (actor["Vai trò"] !== "Quản lý" && reg["Nhân Viên"] !== actor["Mã NV"]) {
    throw new Error("Bạn không có quyền kết ca của nhân viên khác.");
  }

  const attendance = attendanceRows.find(
    (r) => r["Mã Đăng Ký"] === registrationId && r["Trạng thái"] === ATTENDANCE_STATUS.inProgress
  );
  if (!attendance) throw new Error("Bạn cần điểm danh trước khi kết ca.");

  const endTime = timestamp();
  const hours = calculateWorkedHours(attendance["Giờ vào"], endTime);

  await updateByKey(SHEETS.attendance, "Mã Chấm Công", attendance["Mã Chấm Công"], {
    "Giờ ra": endTime,
    "Số giờ": String(hours),
    "Trạng thái": ATTENDANCE_STATUS.completed,
    "Ghi chú": String(note ?? "").trim(),
  });

  return getInitialData(actorEmail);
}

// ─────────────────────────────────────────────
// Payroll
// ─────────────────────────────────────────────

export async function updateHourlyRate(actorEmail: string, employeeId: string, hourlyRate: number): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw new Error("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] !== "Quản lý") throw new Error("Chỉ quản lý mới được cập nhật lương theo giờ.");
  if (!employeeId) throw new Error("Thiếu mã nhân viên.");
  if (!isFinite(hourlyRate) || hourlyRate < 0) throw new Error("Lương theo giờ không hợp lệ.");

  const payrollRows = await readObjects(SHEETS.payroll);
  const existingRow = payrollRows.find((r) => r["Mã NV"] === employeeId);

  if (existingRow) {
    await updateByKey(SHEETS.payroll, "Mã NV", employeeId, {
      "Lương/Giờ": String(hourlyRate),
      "Cập nhật": timestamp(),
    });
  } else {
    await appendObjects(SHEETS.payroll, [{
      "Mã NV": employeeId,
      "Lương/Giờ": String(hourlyRate),
      "Ghi chú": "",
      "Cập nhật": timestamp(),
    }]);
  }

  return getInitialData(actorEmail);
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

async function softDeletePendingForWeek(employeeId: string, mondayStr: string): Promise<void> {
  if (!mondayStr) return;
  const monday = parseDateKey(normalizeDateKey(mondayStr));
  if (!monday) return;
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const registrations = await readObjects(SHEETS.registrations);
  const toDelete = registrations.filter((row) => {
    if (row["Nhân Viên"] !== employeeId) return false;
    if (row["Tình Trạng"] !== STATUS.pending) return false;
    if (isDeleted(row)) return false;
    const d = parseDateKey(normalizeDateKey(row["Ngày"]));
    return d && d >= monday && d <= sunday;
  });

  await Promise.all(
    toDelete.map((row) =>
      updateByKey(SHEETS.registrations, "Mã Đăng Ký", row["Mã Đăng Ký"], { "IsDelete": "TRUE" })
    )
  );
}

function parseDateKey(dateKey: string): Date | null {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
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
  const todayKey = normalizeDateKey(new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }));
  const inProgress = attendanceRows.filter((r) => r["Trạng thái"] === ATTENDANCE_STATUS.inProgress);
  const completed = attendanceRows.filter((r) => r["Trạng thái"] === ATTENDANCE_STATUS.completed);
  const pending = registrations.filter((r) => r["Tình Trạng"] === STATUS.pending);
  const todayRows = registrations.filter((r) => normalizeDateKey(r["Ngày"]) === todayKey);

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
