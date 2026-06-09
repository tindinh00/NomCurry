import { ReloadButton } from "@/app/components/common/Actions";
import { MakeupAttendanceReviewPanel } from "@/app/components/common/MakeupAttendanceReviewPanel";
import { RegistrationPanel } from "@/app/components/common/RegistrationPanel";
import { ScreenHeader } from "@/app/components/common/ScreenHeader";
import { WeeklyScheduleGrid } from "@/app/components/common/WeeklyScheduleGrid";
import type { AppState, MutateAppState } from "@/app/types/nomcurry";

export type ApprovalScreenProps = {
  state: AppState;
  reload: () => void;
  mutate: MutateAppState;
};

export function ApprovalScreen({ state, reload, mutate }: ApprovalScreenProps) {
  return (
    <section className="grid gap-5">
      <ScreenHeader
        eyebrow="Duyệt ca"
        title="Phê duyệt đăng ký"
        subtitle="Tất cả đăng ký ca từ nhân viên, nhóm theo tuần."
        action={<ReloadButton reload={reload} />}
      />
      <WeeklyScheduleGrid state={state} rows={state.registrations} />
      <MakeupAttendanceReviewPanel state={state} mutate={mutate} />
      <RegistrationPanel
        title="Danh sách đăng ký"
        description="Lọc theo trạng thái để xem chờ duyệt, đã chốt hoặc từ chối."
        state={state}
        rows={state.registrations}
        mutate={mutate}
        allowWeekApprove
      />
    </section>
  );
}
