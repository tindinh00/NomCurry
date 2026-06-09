"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import { StatusBadge } from "@/app/components/common/StatusBadge";
import { MAKEUP_ATTENDANCE_STATUS } from "@/app/lib/nomcurry/constants";
import { formatHours } from "@/app/lib/nomcurry/format";
import { findEmployee, findShift } from "@/app/lib/nomcurry/selectors";
import type { AppState, MakeupAttendanceRequest, MutateAppState } from "@/app/types/nomcurry";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export type MakeupAttendanceReviewPanelProps = {
  state: AppState;
  mutate: MutateAppState;
};

export function MakeupAttendanceReviewPanel({ state, mutate }: MakeupAttendanceReviewPanelProps) {
  const [reviewRequest, setReviewRequest] = useState<MakeupAttendanceRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState("");
  const [managerNote, setManagerNote] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const pendingMakeupRequests = state.makeupAttendanceRequests.filter(
    (request) => request.status === MAKEUP_ATTENDANCE_STATUS.pending
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Yêu cầu điểm danh bù</CardTitle>
          <CardDescription>Quản lý duyệt để ghi giờ công vào bảng chấm công, hoặc từ chối nếu thông tin chưa hợp lệ.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {pendingMakeupRequests.length ? pendingMakeupRequests.map((request) => (
            <div key={request.requestId} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{findEmployee(state, request.employeeId)?.["Tên NV"] || request.employeeId}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {request.date} · {findShift(state, request.shiftId)?.["Tên Ca"] || request.shiftId}
                </p>
                <p className="text-sm">
                  {formatRequestTime(request.proposedCheckIn)} → {formatRequestTime(request.proposedCheckOut)} · {formatHours(request.workedHours)} giờ
                </p>
                <p className="text-sm text-muted-foreground">Lý do: {request.reason}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                <Button
                  onClick={() => {
                    setReviewRequest(request);
                    setReviewDecision(MAKEUP_ATTENDANCE_STATUS.approved);
                    setManagerNote("");
                  }}
                >
                  Duyệt
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setReviewRequest(request);
                    setReviewDecision(MAKEUP_ATTENDANCE_STATUS.rejected);
                    setManagerNote("");
                  }}
                >
                  Từ chối
                </Button>
              </div>
            </div>
          )) : (
            <Alert>
              <AlertTitle>Không có yêu cầu chờ duyệt</AlertTitle>
              <AlertDescription>Khi nhân viên gửi điểm danh bù, yêu cầu sẽ xuất hiện ở đây.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(reviewRequest)} onOpenChange={(open) => !open && !isReviewing && closeReviewDialog()}>
        <DialogContent showCloseButton={!isReviewing}>
          <DialogHeader>
            <DialogTitle>{reviewDecision === MAKEUP_ATTENDANCE_STATUS.approved ? "Duyệt điểm danh bù" : "Từ chối điểm danh bù"}</DialogTitle>
            <DialogDescription>
              {reviewRequest
                ? `${findEmployee(state, reviewRequest.employeeId)?.["Tên NV"] || reviewRequest.employeeId} · ${reviewRequest.date}`
                : "Xác nhận xử lý yêu cầu."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="manager-note">Ghi chú quản lý</FieldLabel>
              <Textarea
                id="manager-note"
                value={managerNote}
                onChange={(event) => setManagerNote(event.target.value)}
                placeholder="Ví dụ: Đã đối chiếu camera / chưa đủ thông tin..."
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" size="lg" className="w-full sm:w-44" disabled={isReviewing} onClick={closeReviewDialog}>
              Hủy
            </Button>
            <Button
              size="lg"
              variant={reviewDecision === MAKEUP_ATTENDANCE_STATUS.rejected ? "destructive" : "default"}
              className="w-full sm:w-44"
              disabled={isReviewing}
              onClick={() => {
                if (!reviewRequest) return;
                setIsReviewing(true);
                mutate("/api/attendance/makeup-review", {
                  requestId: reviewRequest.requestId,
                  decision: reviewDecision,
                  managerNote,
                }, reviewDecision === MAKEUP_ATTENDANCE_STATUS.approved ? "Đã duyệt điểm danh bù" : "Đã từ chối điểm danh bù")
                  .then(closeReviewDialog)
                  .finally(() => setIsReviewing(false));
              }}
            >
              {isReviewing ? <Loader2Icon className="size-5 animate-spin" /> : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  function closeReviewDialog() {
    setReviewRequest(null);
    setReviewDecision("");
    setManagerNote("");
  }
}

function formatRequestTime(value: string) {
  const match = String(value || "").match(/\b(\d{2}):(\d{2})(?::\d{2})?$/);
  return match ? `${match[1]}:${match[2]}` : value || "-";
}
