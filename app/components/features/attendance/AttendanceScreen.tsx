"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

import { ReloadButton } from "@/app/components/common/Actions";
import { ScreenHeader } from "@/app/components/common/ScreenHeader";
import { StatusBadge } from "@/app/components/common/StatusBadge";
import { useAttendanceCheckout } from "@/app/hooks/useAttendanceCheckout";
import { ATTENDANCE_STATUS } from "@/app/lib/nomcurry/constants";
import { appDateTime, normalizeDateKey, todayKey } from "@/app/lib/nomcurry/date";
import { formatHours } from "@/app/lib/nomcurry/format";
import { findShift } from "@/app/lib/nomcurry/selectors";
import type { AppState, MutateAppState } from "@/app/types/nomcurry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export type AttendanceScreenProps = {
  state: AppState;
  reload: () => void;
  mutate: MutateAppState;
};

export function AttendanceScreen({ state, reload, mutate }: AttendanceScreenProps) {
  const checkout = useAttendanceCheckout(state);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const active = state.attendanceItems.find((item) => item.status === ATTENDANCE_STATUS.inProgress);

  const getDisplayStatus = (item: typeof state.attendanceItems[0]) => {
    if (item.status === ATTENDANCE_STATUS.notCheckedIn) {
      const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
      if (isShiftExpired(shiftName, item.date)) {
        return "Quên điểm danh";
      }
    }
    if (item.status === ATTENDANCE_STATUS.inProgress) {
      const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
      if (isShiftExpired(shiftName, item.date)) {
        return "Quên kết ca";
      }
    }
    return item.status;
  };

  const pending = state.attendanceItems.find((item) => {
    if (item.status !== ATTENDANCE_STATUS.notCheckedIn) return false;
    const shiftName = findShift(state, item.shiftId)?.["Tên Ca"] || "";
    return !isShiftExpired(shiftName, item.date) && normalizeDateKey(item.date) === todayKey();
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
                ? `${findShift(state, checkout.checkoutItem.shiftId)?.["Tên Ca"] || checkout.checkoutItem.shiftId} · ${checkout.checkoutItem.date}`
                : "Nhập ghi chú trước khi kết ca."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="checkout-note">Ghi chú</FieldLabel>
              <Textarea
                id="checkout-note"
                value={checkout.checkoutNote}
                onChange={(event) => checkout.setCheckoutNote(event.target.value)}
                placeholder="Ví dụ: Đã bàn giao ca, dọn dẹp quầy sạch sẽ..."
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
    </section>
  );
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

