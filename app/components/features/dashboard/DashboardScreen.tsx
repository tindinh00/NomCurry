import { BanknoteIcon, CalendarCheckIcon, CheckIcon, ClockIcon } from "lucide-react";

import { ReloadButton } from "@/app/components/common/Actions";
import { MetricCard } from "@/app/components/common/MetricCard";
import { RegistrationPanel } from "@/app/components/common/RegistrationPanel";
import { ScreenHeader } from "@/app/components/common/ScreenHeader";
import { formatHours, formatMoney, formatNumber, formatToday } from "@/app/lib/nomcurry/format";
import type { AppState, MutateAppState } from "@/app/types/nomcurry";

export type DashboardScreenProps = {
  state: AppState;
  reload: () => void;
  mutate: MutateAppState;
};

export function DashboardScreen({ state, reload, mutate }: DashboardScreenProps) {
  return (
    <section className="grid gap-5">
      <ScreenHeader
        eyebrow={formatToday()}
        title="Tổng quan vận hành"
        subtitle="Theo dõi đăng ký ca, ca đã chốt và quỹ lương dự kiến."
        action={<ReloadButton reload={reload} />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard title="Đăng ký chờ duyệt" value={formatNumber(state.dashboard.pendingCount)} icon={CalendarCheckIcon} />
        <MetricCard title="Ca đang làm" value={formatNumber(state.dashboard.inProgressCount)} icon={ClockIcon} />
        <MetricCard title="Tổng giờ thực tế" value={formatHours(state.dashboard.totalHours)} icon={CheckIcon} />
        <MetricCard title="Lương dự kiến" value={formatMoney(state.dashboard.totalPay)} icon={BanknoteIcon} />
      </div>

      <RegistrationPanel
        title="Danh sách đăng ký ca"
        description="Nhóm theo tuần, duyệt từng ca hoặc duyệt cả tuần một lần."
        state={state}
        rows={state.registrations}
        mutate={mutate}
        allowWeekApprove
      />
    </section>
  );
}
