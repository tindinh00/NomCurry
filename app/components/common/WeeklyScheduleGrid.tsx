"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { REGISTRATION_STATUS } from "@/app/lib/nomcurry/constants";
import { getDayLabel, getWeekDays, getWeekLabel, getWeekMonday, normalizeDateKey, shiftWeek, todayKey } from "@/app/lib/nomcurry/date";
import { findEmployee } from "@/app/lib/nomcurry/selectors";
import type { AppState, SheetRow } from "@/app/types/nomcurry";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SlotState = {
  approved: SheetRow[];
  pending: SheetRow[];
};

export function WeeklyScheduleGrid({ state, rows }: { state: AppState; rows: SheetRow[] }) {
  const [monday, setMonday] = useState(getWeekMonday(todayKey()));
  const days = useMemo(() => getWeekDays(monday), [monday]);
  const slotMap = useMemo(() => buildSlotMap(rows), [rows]);
  const stats = useMemo(() => buildStats(slotMap, state.shifts, days), [days, slotMap, state.shifts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sơ đồ ca trong tuần</CardTitle>
        <CardDescription className="hidden sm:block">Ô xanh là ca đã chốt, ô vàng là ca đang chờ duyệt, ô trắng là chưa có ai làm.</CardDescription>
        <CardAction className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" onClick={() => setMonday((current) => shiftWeek(current, -1))} aria-label="Tuần trước">
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonday(getWeekMonday(todayKey()))}>
            Tuần này
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setMonday((current) => shiftWeek(current, 1))} aria-label="Tuần sau">
            <ChevronRightIcon />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
          <p className="font-medium">{getWeekLabel(monday)}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{stats.approved} đã chốt</Badge>
            <Badge variant="outline">{stats.pending} chờ duyệt</Badge>
            <Badge variant="ghost">{stats.empty} trống</Badge>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm md:hidden">
          <p className="font-medium">{getWeekLabel(monday)}</p>
          <p className="whitespace-nowrap text-xs text-muted-foreground">
            {stats.approved} chốt · {stats.pending} chờ · {stats.empty} trống
          </p>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <div className="min-w-[760px] rounded-lg border">
            <div className="grid grid-cols-[9rem_repeat(7,minmax(5.5rem,1fr))] border-b bg-muted/50">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Ca làm</div>
              {days.map((date) => (
                <div key={date} className="px-2 py-2 text-center">
                  <p className="text-xs font-semibold">{getDayLabel(date)}</p>
                  <p className="text-xs text-muted-foreground">{date.slice(5)}</p>
                </div>
              ))}
            </div>

            {state.shifts.map((shift) => (
              <div key={shift["Mã Ca"]} className="grid grid-cols-[9rem_repeat(7,minmax(5.5rem,1fr))] border-b last:border-b-0">
                <div className="flex min-h-14 items-center border-r px-3 py-2">
                  <p className="line-clamp-2 text-sm font-medium">{shift["Tên Ca"] || shift["Mã Ca"]}</p>
                </div>
                {days.map((date) => {
                  const slot = slotMap.get(`${date}|${shift["Mã Ca"]}`) ?? { approved: [], pending: [] };
                  return <ScheduleCell key={`${date}|${shift["Mã Ca"]}`} state={state} slot={slot} variant="table" />;
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="md:hidden">
          <div className="rounded-lg border bg-card p-2.5">
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-1">
              <div />
              {days.map((date) => (
                <div key={date} className="text-center">
                  <p className="text-[10px] font-semibold leading-tight">{getShortDayLabel(date)}</p>
                  <p className="text-[10px] leading-tight text-muted-foreground">{date.slice(8)}</p>
                </div>
              ))}

              {state.shifts.map((shift) => (
                <div key={shift["Mã Ca"]} className="contents">
                  <div className="flex h-7 min-w-0 items-center pr-1">
                    <p className="truncate text-[11px] font-medium" title={shift["Tên Ca"] || shift["Mã Ca"]}>
                      {getCompactShiftLabel(shift)}
                    </p>
                  </div>
                  {days.map((date) => {
                    const slot = slotMap.get(`${date}|${shift["Mã Ca"]}`) ?? { approved: [], pending: [] };
                    return <ScheduleCell key={`${date}|${shift["Mã Ca"]}`} state={state} slot={slot} variant="heatmap" />;
                  })}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2.5 rounded-sm border border-border bg-background" />
              <span>Trống</span>
              <span className="size-2.5 rounded-sm border border-amber-300 bg-amber-300" />
              <span>Chờ</span>
              <span className="size-2.5 rounded-sm border border-primary/40 bg-primary" />
              <span>Chốt</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleCell({ state, slot, variant }: { state: AppState; slot: SlotState; variant: "table" | "heatmap" }) {
  const approvedNames = slot.approved.map((row) => findEmployee(state, row["Nhân Viên"])?.["Tên NV"] || row["Nhân Viên"]);
  const pendingNames = slot.pending.map((row) => findEmployee(state, row["Nhân Viên"])?.["Tên NV"] || row["Nhân Viên"]);
  const hasApproved = approvedNames.length > 0;
  const hasPending = pendingNames.length > 0;
  const tooltip = [
    hasApproved ? `Đã chốt: ${approvedNames.join(", ")}` : "",
    hasPending ? `Chờ duyệt: ${pendingNames.join(", ")}` : "",
    !hasApproved && !hasPending ? "Chưa có ai đăng ký" : "",
  ].filter(Boolean).join("\n");

  if (variant === "table") {
    return (
      <div className="relative group/cell flex min-h-14 items-center justify-center border-r p-1.5 last:border-r-0" title={tooltip}>
        <div
          className={cn(
            "grid h-10 w-full place-items-center rounded-md border text-center text-xs font-medium transition-colors",
            hasApproved && "border-primary/40 bg-secondary text-secondary-foreground",
            !hasApproved && hasPending && "border-amber-300 bg-amber-50 text-amber-800",
            !hasApproved && !hasPending && "border-border bg-background text-muted-foreground"
          )}
        >
          {hasApproved ? "Đã chốt" : hasPending ? `${pendingNames.length} chờ` : ""}
        </div>
        <CellTooltip tooltip={tooltip} />
      </div>
    );
  }

  return (
    <div className="relative group/cell grid h-7 place-items-center" title={tooltip}>
      <div
        className={cn(
          "size-5 rounded-[5px] border transition-colors",
          hasApproved && "border-primary/40 bg-primary hover:bg-primary/85",
          !hasApproved && hasPending && "border-amber-300 bg-amber-300 hover:bg-amber-400",
          !hasApproved && !hasPending && "border-border bg-background hover:bg-muted"
        )}
      />
      <CellTooltip tooltip={tooltip} />
    </div>
  );
}

function CellTooltip({ tooltip }: { tooltip: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-56 -translate-x-1/2 rounded-lg border bg-popover p-2 text-xs text-popover-foreground shadow-lg group-hover/cell:block">
      <pre className="whitespace-pre-wrap font-sans">{tooltip}</pre>
    </div>
  );
}

function buildSlotMap(rows: SheetRow[]) {
  const map = new Map<string, SlotState>();
  rows.forEach((row) => {
    const status = row["Tình Trạng"];
    if (status !== REGISTRATION_STATUS.approved && status !== REGISTRATION_STATUS.pending) return;

    const date = normalizeDateKey(row["Ngày"]);
    const shiftId = String(row["Ca Làm"] ?? "").trim();
    if (!date || !shiftId) return;

    const key = `${date}|${shiftId}`;
    const current = map.get(key) ?? { approved: [], pending: [] };
    if (status === REGISTRATION_STATUS.approved) current.approved.push(row);
    if (status === REGISTRATION_STATUS.pending) current.pending.push(row);
    map.set(key, current);
  });
  return map;
}

function buildStats(slotMap: Map<string, SlotState>, shifts: SheetRow[], days: string[]) {
  return days.reduce((summary, date) => {
    shifts.forEach((shift) => {
      const slot = slotMap.get(`${date}|${shift["Mã Ca"]}`);
      if (slot?.approved.length) summary.approved += 1;
      else if (slot?.pending.length) summary.pending += 1;
      else summary.empty += 1;
    });
    return summary;
  }, { approved: 0, pending: 0, empty: 0 });
}

function getShortDayLabel(date: string) {
  const label = getDayLabel(date);
  if (label === "CN") return "CN";
  return label.replace("Thứ ", "T");
}

function getCompactShiftLabel(shift: SheetRow) {
  const name = String(shift["Tên Ca"] || shift["Mã Ca"] || "");
  const timeRange = name.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (timeRange) return `${timeRange[1].padStart(2, "0")}-${timeRange[3].padStart(2, "0")}`;
  return String(shift["Mã Ca"] || name).slice(0, 6);
}
