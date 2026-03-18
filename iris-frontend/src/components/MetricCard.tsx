"use client";

import type { MetricItem } from "@/types/analysis";

interface MetricCardProps {
  metric: MetricItem;
}

export function MetricCard({ metric }: MetricCardProps) {
  const isPositive = metric.change != null && metric.change > 0;
  const isNegative = metric.change != null && metric.change < 0;

  return (
    <div className="border border-[var(--iris-border)] p-2">
      <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--iris-text-muted)]">
        {metric.label}
      </p>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[16px] font-semibold text-[var(--iris-data)]">
          {metric.value}
        </span>
        {metric.unit && (
          <span className="text-[10px] text-[var(--iris-text-muted)]">
            {metric.unit}
          </span>
        )}

        {metric.change != null && (
          <span
            className={`font-mono text-[11px] font-medium ${
              isPositive
                ? "text-[var(--iris-bullish)]"
                : isNegative
                  ? "text-[var(--iris-bearish)]"
                  : "text-[var(--iris-text-muted)]"
            }`}
          >
            {isPositive ? "+" : ""}
            {metric.change.toFixed(1)}%
          </span>
        )}

        {metric.change != null && metric.changeLabel && (
          <span className="text-[10px] text-[var(--iris-text-muted)]">
            {metric.changeLabel}
          </span>
        )}
      </div>
    </div>
  );
}
