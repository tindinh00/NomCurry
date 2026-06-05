"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCheckIcon, CheckIcon, Trash2Icon, XIcon } from "lucide-react";

import { Pagination } from "@/app/components/common/Actions";
import { StatusBadge } from "@/app/components/common/StatusBadge";
import { PAGE_SIZE, REGISTRATION_STATUS } from "@/app/lib/nomcurry/constants";
import { getDayLabel, getWeekLabel, normalizeDateKey } from "@/app/lib/nomcurry/date";
import { findEmployee, findShift, groupRegistrationsByWeek, registrationHaystack, sortRegistrationsNewest } from "@/app/lib/nomcurry/selectors";
import type { AppState, MutateAppState, SheetRow } from "@/app/types/nomcurry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type RegistrationPanelProps = {
  title: string;
  description: string;
  state: AppState;
  rows: SheetRow[];
  mutate: MutateAppState;
  allowWeekApprove?: boolean;
};

/**
 * Shared registration list with filtering, paging, and (optional) week-grouped approve flow.
 * - allowWeekApprove=true → groups by week with "Duyệt cả tuần"; mobile uses cards
 * - allowWeekApprove=false → flat paginated table; mobile also uses cards for action accessibility
 */
export function RegistrationPanel({ title, description, state, rows, mutate, allowWeekApprove = false }: RegistrationPanelProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => rows
    .filter((row) => status === "all" || row["Tình Trạng"] === status)
    .filter((row) => !query || registrationHaystack(state, row).includes(query.toLowerCase()))
    .sort(sortRegistrationsNewest), [query, rows, state, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Grouping is used for the approve screen (allowWeekApprove) to show "Duyệt cả tuần"
  const groups = allowWeekApprove ? groupRegistrationsByWeek(visible) : null;

  useEffect(() => setPage(1), [query, status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 md:grid-cols-[1fr_14rem]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Tìm theo ngày, ca, nhân viên"
          />
          <Select value={status} onValueChange={(value) => value && setStatus(value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value={REGISTRATION_STATUS.pending}>Chờ duyệt</SelectItem>
                <SelectItem value={REGISTRATION_STATUS.approved}>Đã chốt</SelectItem>
                <SelectItem value={REGISTRATION_STATUS.rejected}>Từ chối</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {visible.length ? (
          <>
            {/* ── Mobile: card layout (actions always accessible) ── */}
            <div className="grid gap-2 md:hidden">
              {groups
                ? groups.map((group) => (
                    <div key={group.weekKey} className="grid gap-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="text-sm font-semibold text-muted-foreground">{getWeekLabel(group.weekKey)}</p>
                        {state.isManager && group.rows.some((r) => r["Tình Trạng"] === REGISTRATION_STATUS.pending) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 cursor-pointer"
                            onClick={() => mutate("/api/registrations/week-approve", { monday: group.weekKey }, "Đã duyệt cả tuần")}
                          >
                            <CheckCheckIcon className="size-4" />
                            <span>Duyệt cả tuần</span>
                          </Button>
                        ) : null}
                      </div>
                      {group.rows.map((row) => (
                        <RegistrationMobileCard key={row["Mã Đăng Ký"]} state={state} row={row} mutate={mutate} />
                      ))}
                    </div>
                  ))
                : visible.map((row) => (
                    <RegistrationMobileCard key={row["Mã Đăng Ký"]} state={state} row={row} mutate={mutate} />
                  ))}
            </div>

            {/* ── Desktop: table ── */}
            <div className="hidden md:block">
              {groups
                ? groups.map((group) => (
                    <div key={group.weekKey} className="mb-4 grid gap-2">
                      <Separator />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{getWeekLabel(group.weekKey)}</p>
                          <p className="text-sm text-muted-foreground">{group.rows.length} ca</p>
                        </div>
                        {state.isManager && group.rows.some((r) => r["Tình Trạng"] === REGISTRATION_STATUS.pending) ? (
                          <Button
                            size="sm"
                            className="gap-1.5 cursor-pointer"
                            onClick={() => mutate("/api/registrations/week-approve", { monday: group.weekKey }, "Đã duyệt cả tuần")}
                          >
                            <CheckCheckIcon className="size-4" />
                            <span>Duyệt cả tuần</span>
                          </Button>
                        ) : null}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Thứ</TableHead>
                            <TableHead>Ngày</TableHead>
                            <TableHead>Ca</TableHead>
                            <TableHead>Nhân viên</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Ghi chú</TableHead>
                            <TableHead>Thao tác</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map((row) => (
                            <RegistrationTableRow key={row["Mã Đăng Ký"]} state={state} row={row} mutate={mutate} />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))
                : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Thứ</TableHead>
                          <TableHead>Ngày</TableHead>
                          <TableHead>Ca</TableHead>
                          <TableHead>Nhân viên</TableHead>
                          <TableHead>Trạng thái</TableHead>
                          <TableHead>Ghi chú</TableHead>
                          <TableHead>Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visible.map((row) => (
                          <RegistrationTableRow key={row["Mã Đăng Ký"]} state={state} row={row} mutate={mutate} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
            </div>
          </>
        ) : (
          <Alert>
            <AlertTitle>Không có dữ liệu</AlertTitle>
            <AlertDescription>Không có đăng ký phù hợp với bộ lọc hiện tại.</AlertDescription>
          </Alert>
        )}

        {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} setPage={setPage} /> : null}
      </CardContent>
    </Card>
  );
}

function RegistrationTableRow({ state, row, mutate }: { state: AppState; row: SheetRow; mutate: MutateAppState }) {
  return (
    <TableRow>
      <TableCell>{getDayLabel(row["Ngày"])}</TableCell>
      <TableCell>{normalizeDateKey(row["Ngày"])}</TableCell>
      <TableCell>{findShift(state, row["Ca Làm"])?.["Tên Ca"] || row["Ca Làm"]}</TableCell>
      <TableCell>{findEmployee(state, row["Nhân Viên"])?.["Tên NV"] || row["Nhân Viên"]}</TableCell>
      <TableCell><StatusBadge status={row["Tình Trạng"]} /></TableCell>
      <TableCell className="max-w-48 truncate">{row["Ghi chú"] || "–"}</TableCell>
      <TableCell><RegistrationActions state={state} row={row} mutate={mutate} /></TableCell>
    </TableRow>
  );
}

function RegistrationMobileCard({ state, row, mutate }: { state: AppState; row: SheetRow; mutate: MutateAppState }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">{normalizeDateKey(row["Ngày"])} · {findShift(state, row["Ca Làm"])?.["Tên Ca"] || row["Ca Làm"]}</CardTitle>
        <CardDescription>{findEmployee(state, row["Nhân Viên"])?.["Tên NV"] || row["Nhân Viên"]}</CardDescription>
        <CardAction><StatusBadge status={row["Tình Trạng"]} /></CardAction>
      </CardHeader>
      {(row["Ghi chú"] || state.isManager) ? (
        <CardContent className="grid gap-3 pt-0">
          {row["Ghi chú"] ? <p className="text-sm text-muted-foreground">{row["Ghi chú"]}</p> : null}
          <RegistrationActions state={state} row={row} mutate={mutate} />
        </CardContent>
      ) : null}
    </Card>
  );
}

function RegistrationActions({ state, row, mutate }: { state: AppState; row: SheetRow; mutate: MutateAppState }) {
  if (!state.isManager) return null;

  const registrationId = row["Mã Đăng Ký"];
  const pending = row["Tình Trạng"] === REGISTRATION_STATUS.pending;

  return (
    <div className="flex items-center gap-1.5">
      {pending ? (
        <>
          <Button
            className="flex-1 gap-1.5 cursor-pointer"
            variant="default"
            size="sm"
            onClick={() => mutate("/api/registrations/status", { registrationId, status: REGISTRATION_STATUS.approved }, "Đã duyệt ca")}
          >
            <CheckIcon className="size-4" />
            <span>Duyệt</span>
          </Button>
          <Button
            className="flex-1 gap-1.5 cursor-pointer"
            variant="outline"
            size="sm"
            onClick={() => mutate("/api/registrations/status", { registrationId, status: REGISTRATION_STATUS.rejected }, "Đã từ chối ca")}
          >
            <XIcon className="size-4" />
            <span>Từ chối</span>
          </Button>
        </>
      ) : null}
      <Button
        className="flex-1 gap-1.5 cursor-pointer"
        variant="destructive"
        size="sm"
        onClick={() => mutate("/api/registrations/delete", { registrationId }, "Đã xóa đăng ký")}
      >
        <Trash2Icon className="size-4" />
        <span>Xóa</span>
      </Button>
    </div>
  );
}
