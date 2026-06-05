"use client";

import { useMemo, useState } from "react";

import { ScreenHeader } from "@/app/components/common/ScreenHeader";
import { usePayrollRate } from "@/app/hooks/usePayrollRate";
import { normalizeDateKey } from "@/app/lib/nomcurry/date";
import { formatHours, formatMoney, formatNumber } from "@/app/lib/nomcurry/format";
import type { AppState, MutateAppState } from "@/app/types/nomcurry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type PayrollScreenProps = {
  state: AppState;
  mutate: MutateAppState;
};

function getMonthKey(dateStr: string) {
  return normalizeDateKey(dateStr).slice(0, 7);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

export function PayrollScreen({ state, mutate }: PayrollScreenProps) {
  const payrollRate = usePayrollRate(state);
  const [monthFilter, setMonthFilter] = useState<string>(currentMonthKey());

  const availableMonths = useMemo(() => {
    const months = new Set(
      state.attendanceItems
        .filter((item) => item.status === "Đã kết ca" && item.date)
        .map((item) => getMonthKey(item.date))
    );
    return Array.from(months).sort().reverse();
  }, [state.attendanceItems]);

  const filteredSummary = useMemo(() => {
    const rateMap = new Map(state.payrollSummary.map((r) => [r.employeeId, r.hourlyRate]));
    const nameMap = new Map(state.payrollSummary.map((r) => [r.employeeId, r.employeeName]));

    const filtered = monthFilter === "all"
      ? state.attendanceItems.filter((item) => item.status === "Đã kết ca")
      : state.attendanceItems.filter(
          (item) => item.status === "Đã kết ca" && getMonthKey(item.date) === monthFilter
        );

    const byEmployee = new Map<string, { hours: number; shifts: number }>();
    for (const item of filtered) {
      const current = byEmployee.get(item.employeeId) ?? { hours: 0, shifts: 0 };
      byEmployee.set(item.employeeId, {
        hours: current.hours + item.workedHours,
        shifts: current.shifts + 1,
      });
    }

    return state.payrollSummary.map((emp) => {
      const stats = byEmployee.get(emp.employeeId) ?? { hours: 0, shifts: 0 };
      const rate = rateMap.get(emp.employeeId) ?? 0;
      return {
        employeeId: emp.employeeId,
        employeeName: nameMap.get(emp.employeeId) ?? emp.employeeId,
        hourlyRate: rate,
        approvedShifts: stats.shifts,
        totalHours: stats.hours,
        totalPay: stats.hours * rate,
      };
    });
  }, [state.attendanceItems, state.payrollSummary, monthFilter]);

  const totalPay = filteredSummary.reduce((s, r) => s + r.totalPay, 0);

  return (
    <section className="grid gap-5">
      <ScreenHeader
        eyebrow="Bảng lương"
        title="Tính lương theo giờ làm"
        subtitle="Lương được tính từ giờ làm thực tế sau khi nhân viên kết ca."
      />

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nhập lương theo giờ</CardTitle>
            <CardDescription>Cập nhật sẽ ghi trực tiếp vào tab BangLuong.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void mutate("/api/payroll/hourly-rate", {
                  employeeId: payrollRate.employeeId,
                  hourlyRate: payrollRate.hourlyRate,
                }, "Đã lưu lương");
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel>Nhân viên</FieldLabel>
                  <Select value={payrollRate.employeeId} onValueChange={(value) => value && payrollRate.setEmployeeId(value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn nhân viên" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {state.payrollSummary.map((row) => (
                          <SelectItem key={row.employeeId} value={row.employeeId}>
                            {row.employeeName} ({row.employeeId})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="hourly-rate">Lương/Giờ</FieldLabel>
                  <Input
                    id="hourly-rate"
                    type="number"
                    min={0}
                    step={1000}
                    value={payrollRate.hourlyRate}
                    onChange={(event) => payrollRate.setHourlyRate(Number(event.target.value))}
                  />
                </Field>
                <Button type="submit">Lưu lương</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tổng lương dự kiến</CardTitle>
            <CardDescription>Chỉ tính các ca đã điểm danh và kết ca.</CardDescription>
            <CardAction>
              <Badge variant="secondary">{formatMoney(totalPay)}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            {/* Month filter */}
            <Select value={monthFilter} onValueChange={(v) => v && setMonthFilter(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn tháng" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>
                  ))}
                  {!availableMonths.includes(currentMonthKey()) && (
                    <SelectItem value={currentMonthKey()}>{formatMonthLabel(currentMonthKey())}</SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nhân viên</TableHead>
                    <TableHead>Ca kết ca</TableHead>
                    <TableHead>Tổng giờ</TableHead>
                    <TableHead>Lương/Giờ</TableHead>
                    <TableHead>Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSummary.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>{row.employeeName}</TableCell>
                      <TableCell>{formatNumber(row.approvedShifts)}</TableCell>
                      <TableCell>{formatHours(row.totalHours)}</TableCell>
                      <TableCell>{formatMoney(row.hourlyRate)}</TableCell>
                      <TableCell>{formatMoney(row.totalPay)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
