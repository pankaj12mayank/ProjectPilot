import type { ReactNode } from "react";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
};

export function Table<T extends object>({
  columns,
  rows,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div className="pp-table-wrap">
      <table className="pp-table pp-type-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={String(c.key)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={String(c.key)}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
