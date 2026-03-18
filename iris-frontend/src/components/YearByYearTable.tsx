"use client";

import type { YearProjection } from "@/types/analysis";
import { formatNumber, formatPercent } from "@/utils/formatters";

interface YearByYearTableProps {
  data: YearProjection[];
}

export function YearByYearTable({ data }: YearByYearTableProps) {
  if (data.length === 0) return null;

  return (
    <div className="overflow-hidden border border-[var(--iris-border)]">
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-3 py-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--iris-accent)]">
          Year-by-Year Projections
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)]">
              <th className="sticky left-0 bg-[var(--iris-surface)] px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Year
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Revenue
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Growth
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                EBITDA
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Margin
              </th>
              <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                FCF
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <tr
                  key={row.year}
                  className={`border-b border-[var(--iris-border)]/50 last:border-0 ${
                    isEven ? "bg-transparent" : "bg-[var(--iris-surface)]/20"
                  }`}
                  style={{ height: "28px" }}
                >
                  <td className="sticky left-0 px-3 py-1 font-medium text-[var(--iris-text)]" style={{ background: isEven ? "var(--iris-bg)" : "rgba(14,16,23,0.3)" }}>
                    {row.year}
                  </td>
                  <td className="px-3 py-1 text-right font-mono text-[var(--iris-text-secondary)]">
                    {formatNumber(row.revenue)}
                  </td>
                  <td
                    className={`px-3 py-1 text-right font-mono ${
                      row.growth >= 0
                        ? "text-[var(--iris-bullish)]"
                        : "text-[var(--iris-bearish)]"
                    }`}
                  >
                    {formatPercent(row.growth)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono text-[var(--iris-text-secondary)]">
                    {formatNumber(row.ebitda)}
                  </td>
                  <td className="px-3 py-1 text-right font-mono text-[var(--iris-text-secondary)]">
                    {row.margin.toFixed(1)}%
                  </td>
                  <td className="px-3 py-1 text-right font-mono text-[var(--iris-text-secondary)]">
                    {formatNumber(row.fcf)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
