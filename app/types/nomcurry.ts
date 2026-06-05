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

export type AppState = {
  email: string;
  employee: SheetRow | null;
  isManager: boolean;
  employees: SheetRow[];
  shifts: SheetRow[];
  registrations: SheetRow[];
  attendanceItems: AttendanceItem[];
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

