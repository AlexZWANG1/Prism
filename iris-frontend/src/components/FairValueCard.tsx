"use client";

import type { FairValueData } from "@/types/analysis";
import { formatCurrency } from "@/utils/formatters";

interface FairValueCardProps {
  data: FairValueData;
}

const confidenceLabels: Record<string, string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

export function FairValueCard({ data }: FairValueCardProps) {
  const isUpside = data.upside >= 0;

  // Calculate position percentages for the visual bar
  const maxVal = Math.max(data.fairValue, data.currentPrice) * 1.2;
  const fairPct = Math.min(95, Math.max(5, (data.fairValue / maxVal) * 100));
  const currentPct = Math.min(
    95,
    Math.max(5, (data.currentPrice / maxVal) * 100)
  );

  return (
    <div className="border border-[var(--iris-border)] p-2">
      {/* Row 1: Fair value + current price + gap */}
      <div className="flex items-baseline gap-3">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--iris-text-muted)]">
          DCF Fair Value
        </span>
        <span className="font-mono text-[16px] font-bold text-[var(--iris-accent)]">
          {formatCurrency(data.fairValue, data.currency)}
        </span>
        <span className="text-[10px] text-[var(--iris-text-muted)]">vs</span>
        <span className="font-mono text-[13px] text-[var(--iris-text-secondary)]">
          {formatCurrency(data.currentPrice, data.currency)}
        </span>
        <span
          className={`font-mono text-[14px] font-bold ${
            isUpside
              ? "text-[var(--iris-bullish)]"
              : "text-[var(--iris-bearish)]"
          }`}
        >
          {isUpside ? "+" : ""}
          {data.upside.toFixed(1)}%
        </span>
        <span className="text-[10px] text-[var(--iris-text-muted)]">
          {confidenceLabels[data.confidence] || "MED"} conf
        </span>
      </div>

      {/* Row 2: Thin progress bar */}
      <div className="relative mt-2">
        <div className="h-1 bg-[var(--iris-border)]">
          <div
            className="absolute left-0 top-0 h-full"
            style={{
              width: `${fairPct}%`,
              backgroundColor: isUpside
                ? "var(--iris-bullish)"
                : "var(--iris-bearish)",
              opacity: 0.3,
            }}
          />
        </div>

        {/* Current price marker */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${currentPct}%` }}
        >
          <div className="h-2.5 w-px bg-[var(--iris-text-secondary)]" />
        </div>

        {/* Fair value marker */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${fairPct}%` }}
        >
          <div className="h-2.5 w-px bg-[var(--iris-accent)]" />
        </div>
      </div>

      {/* Row 3: Bar labels */}
      <div className="mt-0.5 flex justify-between text-[9px] text-[var(--iris-text-muted)]">
        <span>0</span>
        <div className="flex gap-3">
          <span className="text-[var(--iris-text-secondary)]">
            Cur {formatCurrency(data.currentPrice, data.currency)}
          </span>
          <span className="text-[var(--iris-accent)]">
            FV {formatCurrency(data.fairValue, data.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
