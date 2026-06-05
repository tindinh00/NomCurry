import type { AppState } from "@/app/types/nomcurry";
import { appendObjects, generateId, normalize, readObjects } from "@/app/lib/sheets/helpers";
import { getInitialData } from "./app-state";
import { SHEETS } from "./shared";

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

  const payrollRows = await readObjects(SHEETS.payroll);
  const hasPay = payrollRows.some((r) => r["Mã NV"] === employeeId);
  if (!hasPay) {
    await appendObjects(SHEETS.payroll, [{ "Mã NV": employeeId, "Lương/Giờ": "0", "Ghi chú": "", "Cập nhật": "" }]);
  }

  return getInitialData(actorEmail);
}
