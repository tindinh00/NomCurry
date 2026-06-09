import type { AppState } from "@/app/types/nomcurry";
import { appendObjects, normalize, readObjects, timestamp, updateByKey } from "@/app/lib/sheets/helpers";
import { getInitialData } from "./app-state";
import { appendAuditLog } from "./audit";
import { badRequest, forbidden, unauthorized } from "./errors";
import { SHEETS } from "./shared";

export async function updateHourlyRate(actorEmail: string, employeeId: string, hourlyRate: number): Promise<AppState> {
  const employees = await readObjects(SHEETS.employees);
  const actor = employees.find((row) => normalize(row["Email"]) === normalize(actorEmail));
  if (!actor) throw unauthorized("Email đăng nhập chưa có trong bảng NhanVien.");
  if (actor["Vai trò"] !== "Quản lý") throw forbidden("Chỉ quản lý mới được cập nhật lương theo giờ.");
  if (!employeeId) throw badRequest("Thiếu mã nhân viên.");
  if (!isFinite(hourlyRate) || hourlyRate < 0) throw badRequest("Lương theo giờ không hợp lệ.");

  const payrollRows = await readObjects(SHEETS.payroll);
  const existingRow = payrollRows.find((r) => r["Mã NV"] === employeeId);

  if (existingRow) {
    const updates = {
      "Lương/Giờ": String(hourlyRate),
      "Cập nhật": timestamp(),
    };
    await updateByKey(SHEETS.payroll, "Mã NV", employeeId, updates);
    await appendAuditLog({
      actorEmail,
      action: "UPDATE_HOURLY_RATE",
      entity: "BangLuong",
      entityId: employeeId,
      before: existingRow,
      after: { ...existingRow, ...updates },
      note: "Cập nhật lương theo giờ.",
    });
  } else {
    const row = {
      "Mã NV": employeeId,
      "Lương/Giờ": String(hourlyRate),
      "Ghi chú": "",
      "Cập nhật": timestamp(),
    };
    await appendObjects(SHEETS.payroll, [row]);
    await appendAuditLog({
      actorEmail,
      action: "CREATE_HOURLY_RATE",
      entity: "BangLuong",
      entityId: employeeId,
      after: row,
      note: "Tạo dòng lương theo giờ.",
    });
  }

  return getInitialData(actorEmail);
}
