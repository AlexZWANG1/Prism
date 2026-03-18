"use client";

import type { FinancialTableData } from "@/types/analysis";

interface FinancialTableProps {
  table: FinancialTableData;
}

function isNegativeValue(val: string | number): boolean {
  if (typeof val === "number") return val < 0;
  if (typeof val === "string") {
    const cleaned = val.replace(/[,$%\s]/g, "");
    if (cleaned.startsWith("(") && cleaned.endsWith(")")) return true;
    return parseFloat(cleaned) < 0;
  }
  return false;
}

export function FinancialTable({ table }: FinancialTableProps) {
  return (
    <div className="overflow-hidden border border-[var(--iris-border)]">
      {/* Title bar */}
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-3 py-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--iris-accent)]">
          {table.title}
        </h3>
      </div>

      {/* Scrollable table area */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)]">
              <th className="sticky left-0 bg-[var(--iris-surface)] px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                {table.headers[0] || ""}
              </th>
              {table.headers.slice(1).map((header) => (
                <th
                  key={header}
                  className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]"
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
                  className={`border-b border-[var(--iris-border)]/50 last:border-0 ${rowBg}`}
                  style={{ height: "28px" }}
                >
                  <td
                    className={`sticky left-0 px-3 py-1 ${
                      row.isHeader
                        ? "bg-[var(--iris-surface)] text-[10px] font-semibold uppercase tracking-wider text-[var(--iris-text-muted)]"
                        : row.isBold
                          ? "font-semibold text-[var(--iris-text)]"
                          : "text-[var(--iris-text-secondary)]"
                    }`}
                    style={{
                      paddingLeft: row.indent
                        ? `${12 + row.indent * 14}px`
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
                  {row.values.map((val, vIdx) => {
                    const negative = isNegativeValue(val);
                    return (
                      <td
                        key={vIdx}
                        className={`px-3 py-1 text-right font-mono ${
                          row.isHeader
                            ? "text-[10px] font-semibold text-[var(--iris-text-muted)]"
                            : negative
                              ? "text-[#EF4444]"
                              : row.isBold
                                ? "font-semibold text-[var(--iris-text)]"
                                : "text-[var(--iris-text-secondary)]"
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
