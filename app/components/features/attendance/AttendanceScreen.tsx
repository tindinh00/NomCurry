"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { ReloadButton } from "@/app/components/common/Actions";
import { ScreenHeader } from "@/app/components/common/ScreenHeader";
import { StatusBadge } from "@/app/components/common/StatusBadge";
import { useAttendanceCheckout } from "@/app/hooks/useAttendanceCheckout";
import { ATTENDANCE_STATUS, MAKEUP_ATTENDANCE_STATUS } from "@/app/lib/nomcurry/constants";
import { appDateTime, normalizeDateKey, todayKey } from "@/app/lib/nomcurry/date";
import { formatHours } from "@/app/lib/nomcurry/format";
import { findShift } from "@/app/lib/nomcurry/selectors";
import type { AppState, AttendanceItem, MutateAppState } from "@/app/types/nomcurry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ADJACENT_SHIFT_GAP_MINUTES = 30;
const LATE_CHECKOUT_NOTE_GRACE_MINUTES = 15;
const CHECK_IN_EARLY_WINDOW_MINUTES = 30;

export type AttendanceScreenProps = {
  state: AppState;
  reload: () => void;
  mutate: MutateAppState;
};

export function AttendanceScreen({ state, reload, mutate }: AttendanceScreenProps) {
  const checkout = useAttendanceCheckout(state);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [makeupItem, setMakeupItem] = useState<AttendanceItem | null>(null);
  const [makeupCheckIn, setMakeupCheckIn] = useState("");
  const [makeupCheckOut, setMakeupCheckOut] = useState("");
  const [makeupReason, setMakeupReason] = useState("");
  const [isSubmittingMakeup, setIsSubmittingMakeup] = useState(false);
  const active = state.attendanceItems.find((item) => item.status === ATTENDANCE_STATUS.inProgress);
  const activeChain = active ? buildAttendanceChain(state, active, new Date()) : [];
  const checkoutChain = checkout.checkoutItem ? buildAttendanceChain(state, checkout.checkoutItem, new Date()) : [];
  const checkoutNoteRequired = checkoutChain.length > 0 && isLateCheckout(checkoutChain);

  const getDisplayStatus = (item: typeof state.attendanceItems[0]) => {
    if (activeChain.some((chainItem) => chainItem.registrationId === item.registrationId && item.status === ATTENDANCE_STATUS.notCheckedIn)) {
      return "Trong chuỗi đang làm";
    }
    if (item.status === ATTENDANCE_STATUS.notCheckedIn) {
      const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
      if (isShiftExpired(shiftName, item.date)) {
        return "Quên điểm danh";
      }
    }
    if (item.status === ATTENDANCE_STATUS.inProgress) {
      if (activeChain.length > 1) {
        return "Đang làm chuỗi ca";
      }
      const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
      if (isShiftInGraceOvertime(shiftName, item.date)) {
        return "Đang làm thêm giờ";
      }
      if (isShiftExpired(shiftName, item.date)) {
        return "Quên kết ca";
      }
    }
    return item.status;
  };

  const pending = state.attendanceItems.find((item) => {
    if (item.status !== ATTENDANCE_STATUS.notCheckedIn) return false;
    const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
    return canCheckInNow(shiftName, item.date) && normalizeDateKey(item.date) === todayKey();
  });

  return (
    <section className="grid gap-5">
      <ScreenHeader
        eyebrow="Điểm danh"
        title="Vào ca và kết ca"
        subtitle="Quên điểm danh kết ca là ăn đòn nha mấy đứa 👊💥"
        action={<ReloadButton reload={reload} />}
      />

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Trạng thái ca làm hôm nay</CardTitle>
            <CardDescription>Vui lòng thực hiện điểm danh vào ca và kết ca đúng giờ.</CardDescription>
          </CardHeader>
          <CardContent>
            {active ? (
              <div className="grid gap-4 rounded-lg border bg-muted/40 p-6 text-center justify-items-center">
                <div className="grid gap-1.5 justify-items-center">
                  <StatusBadge status={getDisplayStatus(active)} />
                  <h3 className="text-2xl font-bold mt-1 text-foreground">{findShift(state, active.shiftId)?.["Tên Ca"] || active.shiftId}</h3>
                  <p className="text-sm text-muted-foreground">
                    Vào ca lúc: <span className="font-medium text-foreground">{active.checkInAt}</span>
                  </p>
                  {activeChain.length > 1 ? (
                    <p className="text-sm font-medium text-primary">
                      Khi kết ca, hệ thống sẽ tự ghi nhận {activeChain.length} ca liền kề.
                    </p>
                  ) : null}
                </div>
                <Button variant="destructive" className="h-12 text-base font-semibold w-full" onClick={() => checkout.setCheckoutId(active.registrationId)}>
                  Kết ca
                </Button>
              </div>
            ) : pending ? (
              <div className="grid gap-4 rounded-lg border bg-muted/40 p-6 text-center justify-items-center">
                <div className="grid gap-1.5 justify-items-center">
                  <StatusBadge status={ATTENDANCE_STATUS.notCheckedIn} />
                  <h3 className="text-2xl font-bold mt-1 text-foreground">{findShift(state, pending.shiftId)?.["Tên Ca"] || pending.shiftId}</h3>
                  <p className="text-sm text-muted-foreground">
                    Ngày làm: <span className="font-medium text-foreground">{pending.date}</span>
                  </p>
                </div>
                <Button
                  className={cn(
                    "h-12 text-base font-semibold transition-all duration-300",
                    isCheckingIn ? "w-12 min-w-12 rounded-full px-0" : "w-full"
                  )}
                  disabled={isCheckingIn}
                  onClick={() => {
                    setIsCheckingIn(true);
                    mutate("/api/attendance/check-in", { registrationId: pending.registrationId }, "Điểm danh thành công")
                      .finally(() => setIsCheckingIn(false));
                  }}
                >
                  {isCheckingIn ? (
                    <Loader2Icon className="size-5 animate-spin" />
                  ) : (
                    "Điểm danh"
                  )}
                </Button>
              </div>
            ) : (
              <Alert>
                <AlertTitle>Ủa, chưa tới ca làm mà ta? 🤔</AlertTitle>
                <AlertDescription>Đã vào ca đâu mà đã vào đây điểm danh rồi đằng ấy ơi!</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách ca đã duyệt</CardTitle>
            <CardDescription>Tất cả các ca đã được quản lý chốt của bạn.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {state.attendanceItems.length ? state.attendanceItems.map((item) => (
              <div key={item.registrationId} className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.date}</p>
                    <p className="text-sm text-muted-foreground">{findShift(state, item.shiftId)?.["Tên Ca"] || item.shiftId}</p>
                  </div>
                  <StatusBadge status={getDisplayStatus(item)} />
                </div>
                <div className="grid gap-0.5 text-sm text-muted-foreground">
                  <p>Vào: {item.checkInAt || "-"}</p>
                  <p>Ra: {item.checkOutAt || "-"}</p>
                </div>
                <p className="text-sm">Số giờ làm: <span className="font-medium">{formatHours(item.workedHours)} giờ</span></p>
                {item.attendanceNote ? <p className="text-sm text-muted-foreground">Ghi chú: {item.attendanceNote}</p> : null}
                {canRequestMakeup(item, state) ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
                      const defaults = getMakeupTimeDefaults(shiftName, item.date);
                      setMakeupItem(item);
                      setMakeupCheckIn(defaults.checkIn);
                      setMakeupCheckOut(defaults.checkOut);
                      setMakeupReason("");
                    }}
                  >
                    Gửi điểm danh bù
                  </Button>
                ) : null}
              </div>
            )) : (
              <Alert>
                <AlertTitle>Chưa có ca đã duyệt</AlertTitle>
                <AlertDescription>Danh sách điểm danh sẽ xuất hiện sau khi ca được chốt.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(checkout.checkoutId)} onOpenChange={(open) => !open && !isCheckingOut && checkout.close()}>
        <DialogContent showCloseButton={!isCheckingOut}>
          <DialogHeader>
            <DialogTitle>Ghi chú kết ca</DialogTitle>
            <DialogDescription>
              {checkout.checkoutItem
                ? checkoutChain.length > 1
                  ? `Hệ thống sẽ tự ghi nhận ${checkoutChain.length} ca liền kề khi xác nhận kết ca.`
                  : `${findShift(state, checkout.checkoutItem.shiftId)?.["Tên Ca"] || checkout.checkoutItem.shiftId} · ${checkout.checkoutItem.date}`
                : "Nhập ghi chú trước khi kết ca."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {checkoutChain.length > 1 ? (
              <Alert>
                <AlertTitle>Chuỗi ca liền kề</AlertTitle>
                <AlertDescription>
                  {checkoutChain.map((item) => findShift(state, item.shiftId)?.["Tên Ca"] || item.shiftId).join(" → ")}
                </AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="checkout-note">{checkoutNoteRequired ? "Ghi chú bắt buộc" : "Ghi chú"}</FieldLabel>
              <Textarea
                id="checkout-note"
                value={checkout.checkoutNote}
                onChange={(event) => checkout.setCheckoutNote(event.target.value)}
                placeholder={checkoutNoteRequired
                  ? "Ví dụ: Ở lại xử lý đơn cuối, dọn quầy thêm..."
                  : "Ví dụ: Đã bàn giao ca, dọn dẹp quầy sạch sẽ..."}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className={cn(isCheckingOut && "items-center justify-center")}>
            {!isCheckingOut && (
              <Button variant="outline" size="lg" className="w-full sm:w-44" onClick={checkout.close}>Hủy</Button>
            )}
            <Button
              size="lg"
              className={cn(
                "transition-all duration-300",
                isCheckingOut ? "w-12 min-w-12 h-12 px-0 rounded-full" : "w-full sm:w-44"
              )}
              disabled={isCheckingOut}
              onClick={() => {
                const id = checkout.checkoutId;
                if (checkoutNoteRequired && checkout.checkoutNote.trim().length < 5) {
                  toast.error("Kết ca muộn quá 15 phút cần nhập ghi chú tối thiểu 5 ký tự.");
                  return;
                }
                setIsCheckingOut(true);
                mutate("/api/attendance/check-out", { registrationId: id, note: checkout.checkoutNote }, "Kết ca thành công")
                  .then(() => {
                    checkout.close();
                    checkout.resetNote();
                  })
                  .finally(() => {
                    setIsCheckingOut(false);
                  });
              }}
            >
              {isCheckingOut ? (
                <Loader2Icon className="size-5 animate-spin" />
              ) : (
                "Xác nhận kết ca"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(makeupItem)} onOpenChange={(open) => !open && !isSubmittingMakeup && closeMakeupDialog()}>
        <DialogContent showCloseButton={!isSubmittingMakeup}>
          <DialogHeader>
            <DialogTitle>Gửi điểm danh bù</DialogTitle>
            <DialogDescription>
              {makeupItem
                ? `${findShift(state, makeupItem.shiftId)?.["Tên Ca"] || makeupItem.shiftId} · ${makeupItem.date}`
                : "Nhập giờ làm thực tế và lý do quên điểm danh."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <MakeupTimeInput
                id="makeup-check-in"
                label="Giờ vào thực tế"
                value={makeupCheckIn}
                onChange={setMakeupCheckIn}
              />
              <MakeupTimeInput
                id="makeup-check-out"
                label="Giờ ra thực tế"
                value={makeupCheckOut}
                onChange={setMakeupCheckOut}
              />
            </div>
            <Field>
              <FieldLabel htmlFor="makeup-reason">Lý do</FieldLabel>
              <Textarea
                id="makeup-reason"
                value={makeupReason}
                onChange={(event) => setMakeupReason(event.target.value)}
                placeholder="Ví dụ: Quên bấm vào ca vì đang chuẩn bị quầy..."
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" size="lg" className="w-full sm:w-44" disabled={isSubmittingMakeup} onClick={closeMakeupDialog}>
              Hủy
            </Button>
            <Button
              size="lg"
              className="w-full sm:w-44"
              disabled={isSubmittingMakeup}
              onClick={() => {
                if (!makeupItem) return;
                const validated = buildMakeupRequestPayload(makeupItem.date, makeupCheckIn, makeupCheckOut, makeupReason);
                if (!validated.ok) {
                  toast.error(validated.error);
                  return;
                }
                setIsSubmittingMakeup(true);
                mutate("/api/attendance/makeup-request", {
                  registrationId: makeupItem.registrationId,
                  proposedCheckIn: validated.proposedCheckIn,
                  proposedCheckOut: validated.proposedCheckOut,
                  reason: validated.reason,
                }, "Đã gửi yêu cầu điểm danh bù")
                  .then(closeMakeupDialog)
                  .finally(() => setIsSubmittingMakeup(false));
              }}
            >
              {isSubmittingMakeup ? <Loader2Icon className="size-5 animate-spin" /> : "Gửi yêu cầu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </section>
  );

  function closeMakeupDialog() {
    setMakeupItem(null);
    setMakeupCheckIn("");
    setMakeupCheckOut("");
    setMakeupReason("");
  }

}

function parseShiftTime(timeStr: string, dateStr: string) {
  const matches = timeStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!matches) return null;
  
  const [, startH, startM, endH, endM] = matches.map(Number);
  
  const start = appDateTime(dateStr, startH, startM);
  let end = appDateTime(dateStr, endH, endM);
  
  if (end < start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  
  return { start, end };
}

function isShiftExpired(shiftName: string, dateStr: string) {
  const timeRange = parseShiftTime(shiftName, dateStr);
  if (!timeRange) return false;
  return new Date() > timeRange.end;
}

function canCheckInNow(shiftName: string, dateStr: string) {
  const timeRange = parseShiftTime(shiftName, dateStr);
  if (!timeRange) return false;
  const now = new Date();
  const earliest = new Date(timeRange.start.getTime() - CHECK_IN_EARLY_WINDOW_MINUTES * 60_000);
  return now >= earliest && now < timeRange.end;
}

function isShiftInGraceOvertime(shiftName: string, dateStr: string) {
  const timeRange = parseShiftTime(shiftName, dateStr);
  if (!timeRange) return false;
  const now = new Date();
  return now > timeRange.end && now.getTime() - timeRange.end.getTime() <= LATE_CHECKOUT_NOTE_GRACE_MINUTES * 60_000;
}

function buildAttendanceChain(state: AppState, active: AttendanceItem, now: Date) {
  const intervals = state.attendanceItems
    .filter((item) => {
      if (item.employeeId !== active.employeeId) return false;
      if (item.status === ATTENDANCE_STATUS.completed) return false;
      if (item.status !== ATTENDANCE_STATUS.notCheckedIn && item.registrationId !== active.registrationId) return false;
      return true;
    })
    .map((item) => {
      const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
      const range = parseShiftTime(shiftName, item.date);
      return range ? { ...item, ...range } : null;
    })
    .filter((item): item is AttendanceItem & { start: Date; end: Date } => Boolean(item))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const activeIndex = intervals.findIndex((item) => item.registrationId === active.registrationId);
  if (activeIndex === -1) return [active];

  const chain = [intervals[activeIndex]];
  let previousEnd = intervals[activeIndex].end;
  for (const item of intervals.slice(activeIndex + 1)) {
    const gapMs = item.start.getTime() - previousEnd.getTime();
    if (gapMs > ADJACENT_SHIFT_GAP_MINUTES * 60_000) break;
    if (item.start.getTime() > now.getTime()) break;
    chain.push(item);
    previousEnd = item.end;
  }
  return chain;
}

function isLateCheckout(chain: Array<AttendanceItem & { end?: Date }>) {
  const last = chain[chain.length - 1];
  if (!last?.end) return false;
  return new Date().getTime() - last.end.getTime() > LATE_CHECKOUT_NOTE_GRACE_MINUTES * 60_000;
}

function canRequestMakeup(item: AttendanceItem, state: AppState) {
  if (state.isManager) return false;
  if (item.status === ATTENDANCE_STATUS.completed) return false;
  const existing = state.makeupAttendanceRequests.find(
    (request) => request.registrationId === item.registrationId && request.status === MAKEUP_ATTENDANCE_STATUS.pending
  );
  if (existing) return false;
  const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
  return isShiftExpired(shiftName, item.date);
}

function MakeupTimeInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="time" value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function getMakeupTimeDefaults(shiftName: string, date: string) {
  const timeRange = parseShiftTime(shiftName, date);
  if (!timeRange) return { checkIn: "09:00", checkOut: "18:00" };
  return {
    checkIn: formatTimeInput(timeRange.start),
    checkOut: formatTimeInput(timeRange.end),
  };
}

function formatTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildMakeupRequestPayload(date: string, checkInTime: string, checkOutTime: string, reasonInput: string) {
  const dateKey = normalizeDateKey(date);
  const reason = reasonInput.trim();
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  const checkOutMinutes = parseTimeToMinutes(checkOutTime);
  if (!dateKey) return { ok: false as const, error: "Ngày ca làm không hợp lệ." };
  if (checkInMinutes === null || checkOutMinutes === null) {
    return { ok: false as const, error: "Vui lòng nhập giờ vào và giờ ra hợp lệ." };
  }
  if (reason.length < 5) {
    return { ok: false as const, error: "Lý do điểm danh bù cần tối thiểu 5 ký tự." };
  }

  const checkOutDate = checkOutMinutes <= checkInMinutes ? nextDateKey(dateKey) : dateKey;
  const workedHours = ((checkOutDate === dateKey ? checkOutMinutes : checkOutMinutes + 24 * 60) - checkInMinutes) / 60;
  if (workedHours <= 0) return { ok: false as const, error: "Giờ ra phải sau giờ vào." };
  if (workedHours > 16) return { ok: false as const, error: "Số giờ điểm danh bù không được vượt quá 16 giờ." };

  return {
    ok: true as const,
    proposedCheckIn: `${dateKey}T${checkInTime}`,
    proposedCheckOut: `${checkOutDate}T${checkOutTime}`,
    reason,
  };
}

function parseTimeToMinutes(value: string) {
  const match = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
