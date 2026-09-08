import type { ReactNode } from "react";

export function FiltersBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm ${className}`.trim()}>
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-[160px] flex-1 space-y-1.5 ${className}`.trim()}>
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

export function SearchField({
  label = "Search",
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <FilterField label={label} className={`min-w-[220px] flex-[1.4] ${className}`.trim()}>
      <input
        className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </FilterField>
  );
}
