"use client";

import type { YearProjection } from "@/types/analysis";
import { formatNumber, formatPercent } from "@/utils/formatters";

interface YearByYearTableProps {
  data: YearProjection[];
}

export function YearByYearTable({ data }: YearByYearTableProps) {
  if (data.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--iris-border)]">
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-5 py-3">
        <h3 className="text-sm font-semibold text-[var(--iris-accent)]">
          Year-by-Year Projections
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)]">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Year
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Revenue
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Growth
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                EBITDA
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Margin
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
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
                  className={`border-b border-[var(--iris-border)]/50 last:border-0 transition-colors hover:bg-[var(--iris-surface-hover)] ${
                    isEven ? "bg-transparent" : "bg-[var(--iris-surface)]/20"
                  }`}
                >
                  <td className="px-5 py-2.5 font-medium text-[var(--iris-text)]">
                    {row.year}
                  </td>
                  <td className="border-l border-[var(--iris-border)]/30 px-4 py-2.5 text-right font-mono text-[var(--iris-text-secondary)]">
                    {formatNumber(row.revenue)}
                  </td>
                  <td
                    className={`border-l border-[var(--iris-border)]/30 px-4 py-2.5 text-right font-mono ${
                      row.growth >= 0
                        ? "text-[var(--iris-bullish)]"
                        : "text-[var(--iris-bearish)]"
                    }`}
                  >
                    {formatPercent(row.growth)}
                  </td>
                  <td className="border-l border-[var(--iris-border)]/30 px-4 py-2.5 text-right font-mono text-[var(--iris-text-secondary)]">
                    {formatNumber(row.ebitda)}
                  </td>
                  <td className="border-l border-[var(--iris-border)]/30 px-4 py-2.5 text-right font-mono text-[var(--iris-text-secondary)]">
                    {row.margin.toFixed(1)}%
                  </td>
                  <td className="border-l border-[var(--iris-border)]/30 px-4 py-2.5 text-right font-mono text-[var(--iris-text-secondary)]">
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
