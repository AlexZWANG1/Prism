"use client";

import type { FinancialTableData } from "@/types/analysis";

interface FinancialTableProps {
  table: FinancialTableData;
}

export function FinancialTable({ table }: FinancialTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--iris-border)]">
      {/* Title bar */}
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-5 py-3">
        <h3 className="text-sm font-semibold text-[var(--iris-accent)]">
          {table.title}
        </h3>
      </div>

      {/* Scrollable table area */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)]">
              <th className="sticky left-0 bg-[var(--iris-surface)] px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                {table.headers[0] || ""}
              </th>
              {table.headers.slice(1).map((header) => (
                <th
                  key={header}
                  className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, idx) => {
              const isEven = idx % 2 === 0;
              const rowBg = row.isHeader
                ? "bg-[var(--iris-surface)]"
                : isEven
                  ? "bg-transparent"
                  : "bg-[var(--iris-surface)]/30";

              return (
                <tr
                  key={idx}
                  className={`border-b border-[var(--iris-border)]/50 last:border-0 transition-colors ${rowBg} ${
                    !row.isHeader ? "hover:bg-[var(--iris-surface-hover)]" : ""
                  }`}
                >
                  <td
                    className={`sticky left-0 px-5 py-2 ${
                      row.isHeader
                        ? "bg-[var(--iris-surface)] text-xs font-semibold uppercase tracking-wider text-[var(--iris-text-muted)]"
                        : row.isBold
                          ? "font-semibold text-[var(--iris-text)]"
                          : "text-[var(--iris-text-secondary)]"
                    }`}
                    style={{
                      paddingLeft: row.indent
                        ? `${20 + row.indent * 16}px`
                        : undefined,
                      background: row.isHeader
                        ? undefined
                        : isEven
                          ? "var(--iris-bg)"
                          : "rgba(14,16,23,0.3)",
                    }}
                  >
                    {row.label}
                  </td>
                  {row.values.map((val, vIdx) => (
                    <td
                      key={vIdx}
                      className={`px-4 py-2 text-right font-mono ${
                        row.isHeader
                          ? "text-xs font-semibold text-[var(--iris-text-muted)]"
                          : row.isBold
                            ? "font-semibold text-[var(--iris-text)]"
                            : "text-[var(--iris-text-secondary)]"
                      }`}
                    >
                      {val}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
