import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReloadButton({ reload }: { reload: () => void }) {
  return (
    <Button variant="outline" onClick={reload}>
      <RefreshCwIcon data-icon="inline-start" />
      Làm mới
    </Button>
  );
}

export type PaginationProps = {
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
};

export function Pagination({ page, totalPages, setPage }: PaginationProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Trang trước">
        <ChevronLeftIcon />
      </Button>
      <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
      <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Trang sau">
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

