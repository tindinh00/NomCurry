"use client";

import { useEffect, useState } from "react";

import type { AppState } from "@/app/types/nomcurry";

export function usePayrollRate(state: AppState) {
  const [employeeId, setEmployeeId] = useState(state.payrollSummary[0]?.employeeId || "");
  const selected = state.payrollSummary.find((row) => row.employeeId === employeeId);
  const [hourlyRate, setHourlyRate] = useState(selected?.hourlyRate || 0);
  const total = state.payrollSummary.reduce((sum, row) => sum + row.totalPay, 0);

  useEffect(() => {
    setHourlyRate(selected?.hourlyRate || 0);
  }, [selected?.hourlyRate]);

  return {
    employeeId,
    hourlyRate,
    total,
    setEmployeeId,
    setHourlyRate,
  };
}

