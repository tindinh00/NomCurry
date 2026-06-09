export type SheetRow = Record<string, string>;

export type AttendanceItem = {
  registrationId: string;
  date: string;
  shiftId: string;
  employeeId: string;
  note: string;
  checkInAt: string;
  checkOutAt: string;
  workedHours: number;
  status: string;
  attendanceNote: string;
};

export type PayrollSummary = {
  employeeId: string;
  employeeName: string;
  email: string;
  role: string;
  approvedShifts: number;
  totalHours: number;
  hourlyRate: number;
  totalPay: number;
};

export type MakeupAttendanceRequest = {
  requestId: string;
  registrationId: string;
  date: string;
  shiftId: string;
  employeeId: string;
  proposedCheckIn: string;
  proposedCheckOut: string;
  workedHours: number;
  reason: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string;
  reviewedAt: string;
  managerNote: string;
};

export type AppState = {
  email: string;
  employee: SheetRow | null;
  isManager: boolean;
  employees: SheetRow[];
  shifts: SheetRow[];
  registrations: SheetRow[];
  attendanceItems: AttendanceItem[];
  makeupAttendanceRequests: MakeupAttendanceRequest[];
  occupiedSlots: { dateKey: string; shiftId: string }[];
  payrollSummary: PayrollSummary[];
  dashboard: {
    pendingCount: number;
    inProgressCount: number;
    todayCount: number;
    totalHours: number;
    totalPay: number;
  };
  message?: string;
};

export type AppRoute = "dashboard" | "approve" | "shifts" | "attendance" | "payroll" | "auth";

export type MutateAppState = (
  url: string,
  payload: Record<string, unknown>,
  success: string
) => Promise<void>;
