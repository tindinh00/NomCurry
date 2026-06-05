export const SHEETS = {
  employees: "NhanVien",
  shifts: "DanhMucCa",
  registrations: "DangKyCa",
  payroll: "BangLuong",
  attendance: "ChamCong",
} as const;

export const STATUS = {
  pending: "Chờ duyệt",
  approved: "Đã chốt",
  rejected: "Từ chối",
} as const;

export const ATTENDANCE_STATUS = {
  inProgress: "Đang làm",
  completed: "Đã kết ca",
  notCheckedIn: "Chưa điểm danh",
} as const;

export function parseDateKey(dateKey: string): Date | null {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
