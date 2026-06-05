"use client";

import { ReloadButton } from "@/app/components/common/Actions";
import { ScreenHeader } from "@/app/components/common/ScreenHeader";
import { StatusBadge } from "@/app/components/common/StatusBadge";
import { useAttendanceCheckout } from "@/app/hooks/useAttendanceCheckout";
import { ATTENDANCE_STATUS } from "@/app/lib/nomcurry/constants";
import { normalizeDateKey, todayKey } from "@/app/lib/nomcurry/date";
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
  const active = state.attendanceItems.find((item) => item.status === ATTENDANCE_STATUS.inProgress);
  const pending = state.attendanceItems.find((item) => item.status === ATTENDANCE_STATUS.notCheckedIn && normalizeDateKey(item.date) === todayKey())
    || state.attendanceItems.find((item) => item.status === ATTENDANCE_STATUS.notCheckedIn);

  return (
    <section className="grid gap-5">
      <ScreenHeader
        eyebrow="Điểm danh"
        title="Vào ca và kết ca"
        subtitle="Chỉ các ca đã được duyệt mới xuất hiện ở đây. Lương tính theo số giờ thực tế sau khi kết ca."
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
              <div className="grid gap-4 rounded-lg border bg-muted/40 p-4">
                <div className="grid gap-1">
                  <StatusBadge status={ATTENDANCE_STATUS.inProgress} />
                  <h3 className="text-xl font-semibold">{findShift(state, active.shiftId)?.["Tên Ca"] || active.shiftId}</h3>
                  <p className="text-sm text-muted-foreground">
                    Vào ca lúc: <span className="font-medium text-foreground">{active.checkInAt}</span>
                  </p>
                </div>
                <Button variant="destructive" size="lg" onClick={() => checkout.setCheckoutId(active.registrationId)}>
                  Kết ca
                </Button>
              </div>
            ) : pending ? (
              <div className="grid gap-4 rounded-lg border bg-muted/40 p-4">
                <div className="grid gap-1">
                  <StatusBadge status={ATTENDANCE_STATUS.notCheckedIn} />
                  <h3 className="text-xl font-semibold">{findShift(state, pending.shiftId)?.["Tên Ca"] || pending.shiftId}</h3>
                  <p className="text-sm text-muted-foreground">
                    Ngày làm: <span className="font-medium text-foreground">{pending.date}</span>
                  </p>
                </div>
                <Button size="lg" onClick={() => mutate("/api/attendance/check-in", { registrationId: pending.registrationId }, "Điểm danh thành công")}>
                  Điểm danh
                </Button>
              </div>
            ) : (
              <Alert>
                <AlertTitle>Không có ca cần điểm danh</AlertTitle>
                <AlertDescription>Hôm nay bạn không có ca làm việc nào cần điểm danh.</AlertDescription>
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
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-sm text-muted-foreground">Vào: {item.checkInAt || "-"} · Ra: {item.checkOutAt || "-"}</p>
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

      <Dialog open={Boolean(checkout.checkoutId)} onOpenChange={(open) => !open && checkout.close()}>
        <DialogContent>
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
          <DialogFooter>
            <Button variant="outline" onClick={checkout.close}>Hủy</Button>
            <Button
              onClick={() => {
                const id = checkout.checkoutId;
                checkout.close();
                void mutate("/api/attendance/check-out", { registrationId: id, note: checkout.checkoutNote }, "Kết ca thành công");
                checkout.resetNote();
              }}
            >
              Xác nhận kết ca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

