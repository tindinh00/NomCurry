import { ReloadButton } from "@/app/components/common/Actions";
import { RegistrationPanel } from "@/app/components/common/RegistrationPanel";
import { ScreenHeader } from "@/app/components/common/ScreenHeader";
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

