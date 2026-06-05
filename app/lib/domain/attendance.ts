import type { AppState } from "@/app/types/nomcurry";
import { todayKey } from "@/app/lib/nomcurry/date";
import {
  appendObjects,
  calculateWorkedHours,
  generateId,
  normalize,
  normalizeDateKey,
  readObjects,
  timestamp,
  updateByKey,
} from "@/app/lib/sheets/helpers";
import { getInitialData } from "./app-state";
import { conflict, forbidden, notFound, unauthorized } from "./errors";
import { ATTENDANCE_STATUS, SHEETS, STATUS } from "./shared";

export async function checkIn(actorEmail: string, registrationId: string): Promise<AppState> {
  const [employees, registrations, attendanceRows] = await Promise.all([
    readObjects(SHEETS.employees),
    readObjects(SHEETS.registrations),
    readObjects(SHEETS.attendance),
  ]);

  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");

  const reg = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!reg) throw notFound("Không tìm thấy ca đăng ký.");
  if (reg["Tình Trạng"] !== STATUS.approved) throw conflict("Chỉ ca đã được duyệt mới được điểm danh.");
  if (actor["Vai trò"] !== "Quản lý" && reg["Nhân Viên"] !== actor["Mã NV"]) {
    throw forbidden("Bạn không có quyền điểm danh ca của nhân viên khác.");
  }
  if (normalizeDateKey(reg["Ngày"]) !== todayKey()) {
    throw conflict("Chỉ có thể điểm danh các ca làm việc trong ngày hôm nay.");
  }

  const existing = attendanceRows.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (existing?.["Trạng thái"] === ATTENDANCE_STATUS.completed) throw conflict("Ca này đã kết ca, không thể điểm danh lại.");
  if (existing?.["Trạng thái"] === ATTENDANCE_STATUS.inProgress) throw conflict("Ca này đã được điểm danh.");

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
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");

  const reg = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!reg) throw notFound("Không tìm thấy ca đăng ký.");
  if (reg["Tình Trạng"] !== STATUS.approved) throw conflict("Chỉ ca đã được duyệt mới được kết ca.");
  if (actor["Vai trò"] !== "Quản lý" && reg["Nhân Viên"] !== actor["Mã NV"]) {
    throw forbidden("Bạn không có quyền kết ca của nhân viên khác.");
  }

  const attendance = attendanceRows.find(
    (r) => r["Mã Đăng Ký"] === registrationId && r["Trạng thái"] === ATTENDANCE_STATUS.inProgress
  );
  if (!attendance) throw conflict("Bạn cần điểm danh trước khi kết ca.");

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
