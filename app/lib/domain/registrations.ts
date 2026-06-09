import type { AppState } from "@/app/types/nomcurry";
import {
  appendObjects,
  generateId,
  isDeleted,
  normalize,
  normalizeDateKey,
  readObjects,
  updateByKey,
} from "@/app/lib/sheets/helpers";
import { getInitialData } from "./app-state";
import { appendAuditLog } from "./audit";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "./errors";
import { parseDateKey, SHEETS, STATUS } from "./shared";

export async function addWeeklyRegistrations(
  actorEmail: string,
  monday: string,
  slots: { date: string; shiftId: string; note: string }[],
  note: string
): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const employee = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!employee) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien: " + actorEmail);

  const registrations = await readObjects(SHEETS.registrations);

  const normalizedSlots = slots
    .map((s) => ({ date: normalizeDateKey(s.date), shiftId: String(s.shiftId).trim(), note: String(s.note || note).trim() }))
    .filter((s) => s.date && s.shiftId);

  const uniqueMap = new Map<string, typeof normalizedSlots[0]>();
  normalizedSlots.forEach((s) => uniqueMap.set(`${s.date}|${s.shiftId}`, s));
  const uniqueSlots = Array.from(uniqueMap.values());

  if (!uniqueSlots.length && !monday) throw badRequest("Vui lòng chọn ít nhất một ca làm trong tuần.");

  const occupied = uniqueSlots.filter((s) => {
    const key = `${normalizeDateKey(s.date)}|${s.shiftId}`;
    return registrations.some(
      (row) => !isDeleted(row) && row["Tình Trạng"] === STATUS.approved &&
        `${normalizeDateKey(row["Ngày"])}|${row["Ca Làm"]}` === key
    );
  });
  if (occupied.length) {
    throw conflict(`Có ${occupied.length} ca đã được chốt. Vui lòng tải lại và chọn lại ca còn trống.`);
  }

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
    await appendAuditLog({
      actorEmail,
      action: "CREATE_WEEKLY_REGISTRATIONS",
      entity: "DangKyCa",
      entityId: employee["Mã NV"],
      after: newRows,
      note: `Tạo/cập nhật ${newRows.length} ca đăng ký trong tuần.`,
    });
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
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] !== "Quản lý") throw forbidden("Chỉ quản lý mới được duyệt hoặc hủy ca.");

  const allowed = [STATUS.approved, STATUS.rejected];
  if (!allowed.includes(status as typeof STATUS.approved)) throw badRequest("Trạng thái không hợp lệ.");

  const registrations = await readObjects(SHEETS.registrations);
  const current = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!current) throw notFound("Không tìm thấy đăng ký: " + registrationId);
  if (isDeleted(current)) throw conflict("Đăng ký này đã bị xóa.");
  if (current["Tình Trạng"] !== STATUS.pending) {
    throw conflict(`Ca này đã được ${current["Tình Trạng"].toLowerCase()} và không thể thay đổi nữa.`);
  }
  if (status === STATUS.approved && hasApprovedRegistrationForSlot(registrations, current)) {
    throw conflict("Ca này đã có nhân viên khác được duyệt. Vui lòng từ chối các đăng ký còn lại.");
  }

  const updates = { "Tình Trạng": status };
  await updateByKey(SHEETS.registrations, "Mã Đăng Ký", registrationId, updates);
  await appendAuditLog({
    actorEmail,
    action: "UPDATE_REGISTRATION_STATUS",
    entity: "DangKyCa",
    entityId: registrationId,
    before: current,
    after: { ...current, ...updates },
    note: `Cập nhật trạng thái đăng ký thành ${status}.`,
  });
  return getInitialData(actorEmail);
}

export async function resolveSlotRegistration(actorEmail: string, registrationId: string): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] !== "Quản lý") throw forbidden("Chỉ quản lý mới được chọn nhân viên cho ca.");

  const registrations = await readObjects(SHEETS.registrations);
  const selected = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!selected) throw notFound("Không tìm thấy đăng ký: " + registrationId);
  if (isDeleted(selected)) throw conflict("Đăng ký này đã bị xóa.");
  if (selected["Tình Trạng"] !== STATUS.pending) {
    throw conflict(`Ca này đã được ${selected["Tình Trạng"].toLowerCase()} và không thể chọn lại.`);
  }
  if (hasApprovedRegistrationForSlot(registrations, selected)) {
    throw conflict("Ca này đã có nhân viên khác được duyệt.");
  }

  const sameSlotPending = registrations.filter((row) =>
    row["Mã Đăng Ký"] !== selected["Mã Đăng Ký"] &&
    !isDeleted(row) &&
    row["Tình Trạng"] === STATUS.pending &&
    slotKey(row) === slotKey(selected)
  );

  await Promise.all([
    updateByKey(SHEETS.registrations, "Mã Đăng Ký", selected["Mã Đăng Ký"], { "Tình Trạng": STATUS.approved }),
    ...sameSlotPending.map((row) =>
      updateByKey(SHEETS.registrations, "Mã Đăng Ký", row["Mã Đăng Ký"], { "Tình Trạng": STATUS.rejected })
    ),
  ]);
  await appendAuditLog({
    actorEmail,
    action: "RESOLVE_SLOT_REGISTRATION",
    entity: "DangKyCa",
    entityId: selected["Mã Đăng Ký"],
    before: { selected, rejected: sameSlotPending },
    after: { approved: selected["Mã Đăng Ký"], rejected: sameSlotPending.map((row) => row["Mã Đăng Ký"]) },
    note: "Chọn một nhân viên cho ca bị trùng.",
  });

  return getInitialData(actorEmail);
}

export async function approveWeekPending(actorEmail: string, mondayStr: string): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] !== "Quản lý") throw forbidden("Chỉ quản lý mới được duyệt ca hàng loạt.");

  const parts = mondayStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) throw badRequest("Ngày không hợp lệ: " + mondayStr);

  const monday = new Date(parts[0], parts[1] - 1, parts[2]);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const registrations = await readObjects(SHEETS.registrations);
  const toApprove = registrations.filter((row) => {
    if (isDeleted(row)) return false;
    if (row["Tình Trạng"] !== STATUS.pending) return false;
    const d = parseDateKey(normalizeDateKey(row["Ngày"]));
    return d && d >= monday && d <= sunday;
  });

  if (!toApprove.length) throw conflict("Không có ca nào đang chờ duyệt trong tuần này.");
  const pendingSlotCounts = buildSlotCounts(toApprove);
  const approvable = toApprove.filter((row) =>
    pendingSlotCounts.get(slotKey(row)) === 1 &&
    !hasApprovedRegistrationForSlot(registrations, row)
  );

  if (!approvable.length) {
    throw conflict("Không có ca không trùng để duyệt. Vui lòng chọn thủ công các ca bị trùng.");
  }

  await Promise.all(
    approvable.map((row) =>
      updateByKey(SHEETS.registrations, "Mã Đăng Ký", row["Mã Đăng Ký"], { "Tình Trạng": STATUS.approved })
    )
  );
  await appendAuditLog({
    actorEmail,
    action: "APPROVE_WEEK_PENDING",
    entity: "DangKyCa",
    entityId: mondayStr,
    before: approvable,
    after: approvable.map((row) => ({ ...row, "Tình Trạng": STATUS.approved })),
    note: `Duyệt ${approvable.length} ca không trùng trong tuần.`,
  });

  return getInitialData(actorEmail);
}

export async function deleteRegistration(actorEmail: string, registrationId: string): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");

  const registrations = await readObjects(SHEETS.registrations);
  const reg = registrations.find((r) => r["Mã Đăng Ký"] === registrationId);
  if (!reg) throw notFound("Không tìm thấy đăng ký: " + registrationId);
  if (isDeleted(reg)) throw conflict("Đăng ký này đã bị xóa.");

  if (actor["Vai trò"] !== "Quản lý") {
    if (reg["Nhân Viên"] !== actor["Mã NV"]) throw forbidden("Bạn không có quyền xóa đăng ký này.");
    if (reg["Tình Trạng"] !== STATUS.pending) throw conflict("Chỉ có thể hủy ca đang ở trạng thái Chờ duyệt.");
  }

  const updates = { "IsDelete": "TRUE" };
  await updateByKey(SHEETS.registrations, "Mã Đăng Ký", registrationId, updates);
  await appendAuditLog({
    actorEmail,
    action: "DELETE_REGISTRATION",
    entity: "DangKyCa",
    entityId: registrationId,
    before: reg,
    after: { ...reg, ...updates },
    note: "Xóa mềm đăng ký ca.",
  });
  return getInitialData(actorEmail);
}

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

function slotKey(row: Record<string, string>) {
  return `${normalizeDateKey(row["Ngày"])}|${String(row["Ca Làm"] ?? "").trim()}`;
}

function hasApprovedRegistrationForSlot(registrations: Record<string, string>[], current: Record<string, string>) {
  const currentKey = slotKey(current);
  return registrations.some((row) =>
    row["Mã Đăng Ký"] !== current["Mã Đăng Ký"] &&
    !isDeleted(row) &&
    row["Tình Trạng"] === STATUS.approved &&
    slotKey(row) === currentKey
  );
}

function buildSlotCounts(registrations: Record<string, string>[]) {
  const counts = new Map<string, number>();
  registrations.forEach((row) => {
    const key = slotKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}
