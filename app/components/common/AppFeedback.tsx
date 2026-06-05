import { Loader2Icon } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center py-20 min-h-[60vh]">
      <Loader2Icon className="size-10 animate-spin text-primary" />
    </div>
  );
}

export function BusyDialog({ message }: { message: string }) {
  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Đang xử lý</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
          <Loader2Icon className="animate-spin" data-icon="inline-start" />
          <span className="text-sm text-muted-foreground">Vui lòng chờ trong giây lát.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

