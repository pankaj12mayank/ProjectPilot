import { Button } from "@/components/shadcn/button";

type Props = {
  page: number; // 0-indexed offset / limit
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

export function Pagination({ page, pageSize, total, onPrev, onNext, className = "" }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.floor(page / pageSize) + 1;
  const from = total === 0 ? 0 : page + 1;
  const to = Math.min(total, page + pageSize);
  const canPrev = page > 0;
  const canNext = page + pageSize < total;

  return (
    <div className={`flex flex-col gap-3 border-t border-border/60 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}>
      <p className="text-xs text-muted-foreground">
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`} <span className="hidden sm:inline">· Page {current} / {totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={!canPrev} onClick={onPrev}>
          Previous
        </Button>
        <span className="min-w-[84px] text-center font-mono text-xs text-muted-foreground sm:hidden">
          {current} / {totalPages}
        </span>
        <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={!canNext} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
