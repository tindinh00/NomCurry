import { Badge } from "@/components/ui/badge";
import { ATTENDANCE_STATUS, REGISTRATION_STATUS } from "@/app/lib/nomcurry/constants";

export function StatusBadge({ status }: { status: string }) {
  if (status === REGISTRATION_STATUS.approved || status === ATTENDANCE_STATUS.completed) {
    return <Badge variant="secondary">{status}</Badge>;
  }

  if (status === REGISTRATION_STATUS.rejected || status === ATTENDANCE_STATUS.notCheckedIn) {
    return <Badge variant="destructive">{status}</Badge>;
  }

  return <Badge variant="outline">{status || REGISTRATION_STATUS.pending}</Badge>;
}

