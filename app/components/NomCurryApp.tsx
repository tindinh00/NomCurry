"use client";

import { AppShell } from "@/app/components/layout/AppShell";
import { LoadingScreen } from "@/app/components/common/AppFeedback";
import { ApprovalScreen } from "@/app/components/features/approval/ApprovalScreen";
import { AttendanceScreen } from "@/app/components/features/attendance/AttendanceScreen";
import { LoginScreen } from "@/app/components/features/auth/LoginScreen";
import { DashboardScreen } from "@/app/components/features/dashboard/DashboardScreen";
import { PayrollScreen } from "@/app/components/features/payroll/PayrollScreen";
import { ShiftRegistrationScreen } from "@/app/components/features/shifts/ShiftRegistrationScreen";
import { useNomCurryApp } from "@/app/hooks/useNomCurryApp";

/**
 * App orchestrator: owns route selection and delegates all real UI to feature screens.
 */
export function NomCurryApp() {
  const app = useNomCurryApp();

  return (
    <AppShell state={app.state} route={app.route} onRoute={app.navigate}>
      {app.loading ? <LoadingScreen /> : null}

      {!app.loading && app.state && !app.state.employee ? (
        <LoginScreen
          state={app.state}
          onSubmit={(name, email) => {
            document.cookie = `nomcurry_actor_email=${encodeURIComponent(email)}; path=/; max-age=31536000`;
            document.cookie = "nomcurry_logged_out=; path=/; max-age=0";
            void app.mutate("/api/auth/register", { name, email }, "Đăng nhập / Đăng ký thành công");
          }}
        />
      ) : null}

      {!app.loading && app.state?.employee ? (
        <main>
          {app.route === "dashboard" ? <DashboardScreen state={app.state} reload={app.load} mutate={app.mutate} /> : null}
          {app.route === "approve" ? <ApprovalScreen state={app.state} reload={app.load} mutate={app.mutate} /> : null}
          {app.route === "shifts" ? <ShiftRegistrationScreen state={app.state} mutate={app.mutate} /> : null}
          {app.route === "attendance" ? <AttendanceScreen state={app.state} reload={app.load} mutate={app.mutate} /> : null}
          {app.route === "payroll" ? <PayrollScreen state={app.state} mutate={app.mutate} /> : null}
        </main>
      ) : null}
    </AppShell>
  );
}

