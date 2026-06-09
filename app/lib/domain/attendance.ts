import type { AppState } from "@/app/types/nomcurry";
import { APP_UTC_OFFSET, APP_TIME_ZONE, appDateTime, todayKey } from "@/app/lib/nomcurry/date";
import {
  appendObjects,
  calculateWorkedHours,
  generateId,
  isDeleted,
  normalize,
  normalizeDateKey,
  parseHours,
  readObjects,
  timestamp,
  updateByKey,
} from "@/app/lib/sheets/helpers";
import { getInitialData } from "./app-state";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "./errors";
import { appendAuditLog } from "./audit";
import { ATTENDANCE_STATUS, MAKEUP_ATTENDANCE_STATUS, SHEETS, STATUS } from "./shared";

const ADJACENT_SHIFT_GAP_MINUTES = 30;
const CHECK_IN_EARLY_WINDOW_MINUTES = 30;
const LATE_CHECKOUT_NOTE_GRACE_MINUTES = 15;
const MAX_CHECKOUT_CHAIN_HOURS = 16;

export async function checkIn(actorEmail: string, registrationId: string): Promise<AppState> {
  const [employees, shifts, registrations, attendanceRows] = await Promise.all([
    readObjects(SHEETS.employees),
    readObjects(SHEETS.shifts),
    readObjects(SHEETS.registrations),
    readObjects(SHEETS.attendance),
  ]);

  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] === "Quản lý") throw forbidden("Quản lý chỉ duyệt ca và yêu cầu điểm danh bù, không thực hiện điểm danh.");

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
  const active = attendanceRows.find(
    (r) => r["Nhân Viên"] === reg["Nhân Viên"] && r["Trạng thái"] === ATTENDANCE_STATUS.inProgress
  );
  if (active) throw conflict("Bạn đang có ca làm chưa kết ca. Vui lòng kết ca trước khi điểm danh ca mới.");

  const shiftName = shifts.find((shift) => shift["Mã Ca"] === reg["Ca Làm"])?.["Tên Ca"] || "";
  const shiftRange = parseShiftRange(shiftName, reg["Ngày"]);
  const checkInAt = parseAppTimestamp(timestamp());
  if (!shiftRange || !checkInAt) throw conflict("Không xác định được khung giờ của ca làm.");
  const earliestCheckIn = new Date(shiftRange.start.getTime() - CHECK_IN_EARLY_WINDOW_MINUTES * 60_000);
  if (checkInAt < earliestCheckIn) {
    throw conflict("Chỉ được điểm danh trong vòng 30 phút trước giờ bắt đầu ca.");
  }
  if (checkInAt >= shiftRange.end) {
    throw conflict("Ca này đã quá giờ điểm danh. Vui lòng gửi yêu cầu điểm danh bù.");
  }

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
  await appendAuditLog({
    actorEmail,
    action: "CHECK_IN",
    entity: "ChamCong",
    entityId: registrationId,
    after: { registrationId, status: ATTENDANCE_STATUS.inProgress },
    note: "Nhân viên điểm danh vào ca.",
  });

  return getInitialData(actorEmail);
}

export async function checkOut(actorEmail: string, registrationId: string, note: string): Promise<AppState> {
  const [employees, shifts, registrations, attendanceRows] = await Promise.all([
    readObjects(SHEETS.employees),
    readObjects(SHEETS.shifts),
    readObjects(SHEETS.registrations),
    readObjects(SHEETS.attendance),
  ]);

  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] === "Quản lý") throw forbidden("Quản lý chỉ duyệt ca và yêu cầu điểm danh bù, không thực hiện kết ca.");

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
  const checkoutAt = parseAppTimestamp(endTime);
  const checkInAt = parseAppTimestamp(attendance["Giờ vào"]);
  if (!checkoutAt || !checkInAt) throw conflict("Dữ liệu giờ điểm danh không hợp lệ.");

  const chain = buildCheckoutChain({
    activeRegistration: reg,
    checkoutAt,
    registrations,
    shifts,
    attendanceRows,
  });
  const lastShiftEnd = chain[chain.length - 1]?.end ?? checkoutAt;
  const cleanNote = String(note ?? "").trim();
  const isLateCheckout = checkoutAt.getTime() - lastShiftEnd.getTime() > LATE_CHECKOUT_NOTE_GRACE_MINUTES * 60_000;
  if (isLateCheckout && cleanNote.length < 5) {
    throw badRequest("Kết ca muộn quá 15 phút cần nhập ghi chú tối thiểu 5 ký tự.");
  }
  const totalHours = Math.round(((checkoutAt.getTime() - checkInAt.getTime()) / 3_600_000) * 100) / 100;
  if (totalHours <= 0) throw badRequest("Giờ kết ca phải sau giờ điểm danh.");
  if (totalHours > MAX_CHECKOUT_CHAIN_HOURS) {
    throw badRequest("Tổng thời gian làm việc không được vượt quá 16 giờ. Vui lòng báo quản lý kiểm tra lại.");
  }

  const segments = buildCheckoutSegments(chain, attendance, checkoutAt, cleanNote);
  if (!segments.length) throw badRequest("Không có ca hợp lệ để kết ca.");

  const [firstSegment, ...nextSegments] = segments;
  await updateByKey(SHEETS.attendance, "Mã Chấm Công", attendance["Mã Chấm Công"], firstSegment.updates);
  if (nextSegments.length) {
    await appendObjects(SHEETS.attendance, nextSegments.map((segment) => segment.row));
  }
  await appendAuditLog({
    actorEmail,
    action: "CHECK_OUT",
    entity: "ChamCong",
    entityId: attendance["Mã Chấm Công"],
    before: attendance,
    after: segments.map((segment) => segment.row),
    note: chain.length > 1
      ? `Kết ca chuỗi ${chain.length} ca liền kề. ${cleanNote}`.trim()
      : "Nhân viên kết ca.",
  });

  return getInitialData(actorEmail);
}

export async function requestMakeupAttendance(
  actorEmail: string,
  registrationId: string,
  proposedCheckIn: string,
  proposedCheckOut: string,
  reason: string
): Promise<AppState> {
  const [employees, registrations, attendanceRows, requests] = await Promise.all([
    readObjects(SHEETS.employees),
    readObjects(SHEETS.registrations),
    readObjects(SHEETS.attendance),
    readObjects(SHEETS.makeupAttendance),
  ]);

  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] === "Quản lý") throw forbidden("Quản lý chỉ duyệt yêu cầu điểm danh bù, không gửi yêu cầu thay nhân viên.");

  const reg = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!reg) throw notFound("Không tìm thấy ca đăng ký.");
  if (reg["Tình Trạng"] !== STATUS.approved) throw conflict("Chỉ ca đã chốt mới được gửi điểm danh bù.");
  if (actor["Vai trò"] !== "Quản lý" && reg["Nhân Viên"] !== actor["Mã NV"]) {
    throw forbidden("Bạn không có quyền gửi điểm danh bù cho ca của nhân viên khác.");
  }

  const completed = attendanceRows.find(
    (row) => row["Mã Đăng Ký"] === registrationId && row["Trạng thái"] === ATTENDANCE_STATUS.completed
  );
  if (completed) throw conflict("Ca này đã có chấm công hoàn tất.");

  const pending = requests.find(
    (row) => row["Mã Đăng Ký"] === registrationId && row["Trạng thái"] === MAKEUP_ATTENDANCE_STATUS.pending
  );
  if (pending) throw conflict("Ca này đang có yêu cầu điểm danh bù chờ duyệt.");

  const checkIn = normalizeDateTimeInput(proposedCheckIn);
  const checkOut = normalizeDateTimeInput(proposedCheckOut);
  if (!checkIn || !checkOut) throw badRequest("Vui lòng nhập giờ vào và giờ ra hợp lệ.");
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) throw badRequest("Lý do điểm danh bù cần tối thiểu 5 ký tự.");

  const registrationDate = normalizeDateKey(reg["Ngày"]);
  const checkInDate = getDatePart(checkIn);
  const checkOutDate = getDatePart(checkOut);
  if (checkInDate !== registrationDate) throw badRequest("Giờ vào phải thuộc ngày của ca đã duyệt.");
  if (checkOutDate !== registrationDate && checkOutDate !== nextDateKey(registrationDate)) {
    throw badRequest("Giờ ra chỉ được cùng ngày hoặc ngày kế tiếp với ca đã duyệt.");
  }

  const hours = calculateWorkedHours(checkIn, checkOut);
  if (hours <= 0) throw badRequest("Giờ ra phải sau giờ vào.");
  if (hours > 16) throw badRequest("Số giờ điểm danh bù không được vượt quá 16 giờ.");

  const requestId = generateId("MAKEUP");
  const row = {
    "Mã Yêu Cầu": requestId,
    "Mã Đăng Ký": registrationId,
    "Ngày": reg["Ngày"],
    "Ca Làm": reg["Ca Làm"],
    "Nhân Viên": reg["Nhân Viên"],
    "Giờ vào đề xuất": checkIn,
    "Giờ ra đề xuất": checkOut,
    "Số giờ": String(hours),
    "Lý do": cleanReason,
    "Trạng thái": MAKEUP_ATTENDANCE_STATUS.pending,
    "Người gửi": actorEmail,
    "Ngày gửi": timestamp(),
    "Người duyệt": "",
    "Ngày duyệt": "",
    "Ghi chú quản lý": "",
  };

  await appendObjects(SHEETS.makeupAttendance, [row]);
  await appendAuditLog({
    actorEmail,
    action: "REQUEST_MAKEUP_ATTENDANCE",
    entity: "ChamCongBu",
    entityId: requestId,
    after: row,
    note: cleanReason,
  });

  return getInitialData(actorEmail);
}

export async function reviewMakeupAttendance(
  actorEmail: string,
  requestId: string,
  decision: string,
  managerNote: string
): Promise<AppState> {
  const [employees, requests, attendanceRows] = await Promise.all([
    readObjects(SHEETS.employees),
    readObjects(SHEETS.makeupAttendance),
    readObjects(SHEETS.attendance),
  ]);

  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] !== "Quản lý") throw forbidden("Chỉ quản lý mới được duyệt điểm danh bù.");

  const request = requests.find((row) => row["Mã Yêu Cầu"] === requestId);
  if (!request) throw notFound("Không tìm thấy yêu cầu điểm danh bù.");
  if (request["Trạng thái"] !== MAKEUP_ATTENDANCE_STATUS.pending) {
    throw conflict("Yêu cầu này đã được xử lý.");
  }

  const nextStatus = decision === MAKEUP_ATTENDANCE_STATUS.approved
    ? MAKEUP_ATTENDANCE_STATUS.approved
    : decision === MAKEUP_ATTENDANCE_STATUS.rejected
      ? MAKEUP_ATTENDANCE_STATUS.rejected
      : "";
  if (!nextStatus) throw badRequest("Quyết định duyệt không hợp lệ.");

  if (nextStatus === MAKEUP_ATTENDANCE_STATUS.approved) {
    const completed = attendanceRows.find(
      (row) => row["Mã Đăng Ký"] === request["Mã Đăng Ký"] && row["Trạng thái"] === ATTENDANCE_STATUS.completed
    );
    if (completed) throw conflict("Ca này đã có chấm công hoàn tất.");

    const attendance = {
      "Mã Chấm Công": generateId("ATT"),
      "Mã Đăng Ký": request["Mã Đăng Ký"],
      "Ngày": request["Ngày"],
      "Ca Làm": request["Ca Làm"],
      "Nhân Viên": request["Nhân Viên"],
      "Giờ vào": request["Giờ vào đề xuất"],
      "Giờ ra": request["Giờ ra đề xuất"],
      "Số giờ": String(parseHours(request["Số giờ"])),
      "Trạng thái": ATTENDANCE_STATUS.completed,
      "Ghi chú": `Điểm danh bù: ${request["Lý do"]}`,
    };
    await appendObjects(SHEETS.attendance, [attendance]);
    await appendAuditLog({
      actorEmail,
      action: "APPROVE_MAKEUP_ATTENDANCE_CREATE_ATTENDANCE",
      entity: "ChamCong",
      entityId: attendance["Mã Chấm Công"],
      after: attendance,
      note: managerNote,
    });
  }

  const updates = {
    "Trạng thái": nextStatus,
    "Người duyệt": actorEmail,
    "Ngày duyệt": timestamp(),
    "Ghi chú quản lý": managerNote.trim(),
  };
  await updateByKey(SHEETS.makeupAttendance, "Mã Yêu Cầu", requestId, updates);
  await appendAuditLog({
    actorEmail,
    action: nextStatus === MAKEUP_ATTENDANCE_STATUS.approved ? "APPROVE_MAKEUP_ATTENDANCE" : "REJECT_MAKEUP_ATTENDANCE",
    entity: "ChamCongBu",
    entityId: requestId,
    before: request,
    after: { ...request, ...updates },
    note: managerNote.trim(),
  });

  return getInitialData(actorEmail);
}

function normalizeDateTimeInput(value: string): string {
  const trimmed = String(value || "").trim();
  const withSpace = trimmed.replace("T", " ");
  const match = withSpace.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return "";
  return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6] ?? "00"}`;
}

function getDatePart(dateTime: string): string {
  return dateTime.slice(0, 10);
}

function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type CheckoutChainItem = {
  registration: Record<string, string>;
  start: Date;
  end: Date;
};

type CheckoutSegment = {
  row: Record<string, string>;
  updates: Record<string, string>;
};

function buildCheckoutChain({
  activeRegistration,
  checkoutAt,
  registrations,
  shifts,
  attendanceRows,
}: {
  activeRegistration: Record<string, string>;
  checkoutAt: Date;
  registrations: Record<string, string>[];
  shifts: Record<string, string>[];
  attendanceRows: Record<string, string>[];
}): CheckoutChainItem[] {
  const attendanceByRegistration = new Map<string, Record<string, string>>();
  attendanceRows.forEach((row) => attendanceByRegistration.set(row["Mã Đăng Ký"], row));

  const items = registrations
    .filter((row) => {
      if (isDeleted(row)) return false;
      if (row["Tình Trạng"] !== STATUS.approved) return false;
      if (row["Nhân Viên"] !== activeRegistration["Nhân Viên"]) return false;
      const attendance = attendanceByRegistration.get(row["Mã Đăng Ký"]);
      if (row["Mã Đăng Ký"] === activeRegistration["Mã Đăng Ký"]) return attendance?.["Trạng thái"] === ATTENDANCE_STATUS.inProgress;
      return !attendance;
    })
    .map((row) => {
      const shiftName = shifts.find((shift) => shift["Mã Ca"] === row["Ca Làm"])?.["Tên Ca"] || "";
      const range = parseShiftRange(shiftName, row["Ngày"]);
      return range ? { registration: row, ...range } : null;
    })
    .filter((item): item is CheckoutChainItem => Boolean(item))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const activeIndex = items.findIndex((item) => item.registration["Mã Đăng Ký"] === activeRegistration["Mã Đăng Ký"]);
  if (activeIndex === -1) {
    const fallback = parseShiftRange("", activeRegistration["Ngày"]);
    return [{
      registration: activeRegistration,
      start: fallback?.start ?? checkoutAt,
      end: fallback?.end ?? checkoutAt,
    }];
  }

  const chain = [items[activeIndex]];
  let previousEnd = items[activeIndex].end;
  for (const item of items.slice(activeIndex + 1)) {
    const gapMs = item.start.getTime() - previousEnd.getTime();
    if (gapMs > ADJACENT_SHIFT_GAP_MINUTES * 60_000) break;
    if (item.start.getTime() > checkoutAt.getTime()) break;
    chain.push(item);
    previousEnd = item.end;
  }
  return chain;
}

function buildCheckoutSegments(
  chain: CheckoutChainItem[],
  firstAttendance: Record<string, string>,
  checkoutAt: Date,
  note: string
): CheckoutSegment[] {
  return chain.flatMap((item, index) => {
    const isFirst = index === 0;
    const isLast = index === chain.length - 1;
    const start = isFirst ? firstAttendance["Giờ vào"] : formatAppDateTime(item.start);
    const end = formatAppDateTime(isLast ? checkoutAt : item.end);
    const hours = calculateWorkedHours(start, end);
    if (hours <= 0) return [];

    const segmentNote = buildCheckoutNote({
      baseNote: note,
      isChain: chain.length > 1,
      isLast,
      isLate: isLast && checkoutAt.getTime() > item.end.getTime(),
    });
    const row = {
      "Mã Chấm Công": isFirst ? firstAttendance["Mã Chấm Công"] : generateId("ATT"),
      "Mã Đăng Ký": item.registration["Mã Đăng Ký"],
      "Ngày": item.registration["Ngày"],
      "Ca Làm": item.registration["Ca Làm"],
      "Nhân Viên": item.registration["Nhân Viên"],
      "Giờ vào": start,
      "Giờ ra": end,
      "Số giờ": String(hours),
      "Trạng thái": ATTENDANCE_STATUS.completed,
      "Ghi chú": segmentNote,
    };

    return [{
      row,
      updates: {
        "Giờ ra": row["Giờ ra"],
        "Số giờ": row["Số giờ"],
        "Trạng thái": row["Trạng thái"],
        "Ghi chú": row["Ghi chú"],
      },
    }];
  });
}

function buildCheckoutNote({
  baseNote,
  isChain,
  isLast,
  isLate,
}: {
  baseNote: string;
  isChain: boolean;
  isLast: boolean;
  isLate: boolean;
}): string {
  const tags = [];
  if (isChain) tags.push("Tự ghi nhận trong chuỗi ca liền kề");
  if (isLate) tags.push("Làm thêm sau giờ kết ca");
  const prefix = tags.length ? `${tags.join("; ")}.` : "";
  return [prefix, isLast ? baseNote : ""].filter(Boolean).join(" ").trim();
}

function parseShiftRange(shiftName: string, dateStr: string): { start: Date; end: Date } | null {
  const matches = String(shiftName || "").match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!matches) return null;
  const [, startH, startM, endH, endM] = matches.map(Number);
  const start = appDateTime(dateStr, startH, startM);
  let end = appDateTime(dateStr, endH, endM);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function parseAppTimestamp(value: string): Date | null {
  const normalized = normalizeDateTimeInput(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${APP_UTC_OFFSET}`);
}

function formatAppDateTime(date: Date): string {
  return date.toLocaleString("sv-SE", { timeZone: APP_TIME_ZONE }).replace("T", " ");
}
