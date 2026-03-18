"use client";

import type { SensitivityCell } from "@/types/analysis";

interface SensitivityHeatmapProps {
  data: SensitivityCell[];
  rowLabel: string;
  colLabel: string;
  rowValues: string[];
  colValues: string[];
}

function getCellStyle(
  value: number,
  baseValue: number,
  isBase: boolean
): { bg: string; text: string; ring?: string } {
  if (isBase) {
    return {
      bg: "rgba(201,168,76,0.12)",
      text: "var(--iris-text)",
      ring: "2px solid var(--iris-accent)",
    };
  }

  const diff = baseValue !== 0 ? ((value - baseValue) / baseValue) * 100 : 0;

  if (diff > 20) return { bg: "rgba(34,197,94,0.25)", text: "#4ade80" };
  if (diff > 10) return { bg: "rgba(34,197,94,0.15)", text: "#86efac" };
  if (diff > 5) return { bg: "rgba(34,197,94,0.08)", text: "#bbf7d0" };
  if (diff > 0) return { bg: "rgba(34,197,94,0.04)", text: "var(--iris-text-secondary)" };
  if (diff > -5) return { bg: "rgba(239,68,68,0.04)", text: "var(--iris-text-secondary)" };
  if (diff > -10) return { bg: "rgba(239,68,68,0.08)", text: "#fca5a5" };
  if (diff > -20) return { bg: "rgba(239,68,68,0.15)", text: "#f87171" };
  return { bg: "rgba(239,68,68,0.25)", text: "#ef4444" };
}

export function SensitivityHeatmap({
  data,
  rowLabel,
  colLabel,
  rowValues,
  colValues,
}: SensitivityHeatmapProps) {
  if (data.length === 0) return null;

  const baseCell = data.find((c) => c.isBase);
  const baseValue =
    baseCell?.value ?? data[Math.floor(data.length / 2)]?.value ?? 0;

  const cellMap = new Map<string, SensitivityCell>();
  data.forEach((cell) => cellMap.set(`${cell.row}-${cell.col}`, cell));

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--iris-border)]">
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-5 py-3">
        <h3 className="text-sm font-semibold text-[var(--iris-accent)]">
          Sensitivity Analysis
        </h3>
        <p className="mt-0.5 text-[11px] text-[var(--iris-text-muted)]">
          {rowLabel} vs {colLabel}
        </p>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--iris-text-muted)]">
                {rowLabel} \ {colLabel}
              </th>
              {colValues.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-center font-mono text-[11px] font-medium text-[var(--iris-accent)]/70"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowValues.map((row) => (
              <tr key={row}>
                <td className="px-3 py-2 font-mono text-[11px] font-medium text-[var(--iris-accent)]/70">
                  {row}
                </td>
                {colValues.map((col) => {
                  const cell = cellMap.get(`${row}-${col}`);
                  const value = cell?.value ?? 0;
                  const isBase = cell?.isBase ?? false;
                  const style = getCellStyle(value, baseValue, isBase);

                  return (
                    <td
                      key={col}
                      className="px-3 py-2 text-center font-mono text-xs transition-colors"
                      style={{
                        backgroundColor: style.bg,
                        color: style.text,
                        fontWeight: isBase ? 700 : 400,
                        outline: style.ring || "none",
                        outlineOffset: "-1px",
                        borderRadius: isBase ? "4px" : undefined,
                      }}
                    >
                      ${value.toFixed(0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
