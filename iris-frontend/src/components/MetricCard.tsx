"use client";

import type { MetricItem } from "@/types/analysis";

interface MetricCardProps {
  metric: MetricItem;
}

export function MetricCard({ metric }: MetricCardProps) {
  const isPositive = metric.change != null && metric.change > 0;
  const isNegative = metric.change != null && metric.change < 0;

  return (
    <div
      className="group relative overflow-hidden rounded-lg border border-[var(--iris-border)] p-4 transition-all duration-200 hover:border-[var(--iris-border)]/60 hover:bg-[var(--iris-surface-hover)]"
      style={{
        background:
          "linear-gradient(135deg, rgba(14,16,23,0.8) 0%, rgba(14,16,23,0.4) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--iris-border)] to-transparent" />

      <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[var(--iris-text-muted)]">
        {metric.label}
      </p>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold text-[var(--iris-data)]">
          {metric.value}
        </span>
        {metric.unit && (
          <span className="text-xs text-[var(--iris-text-muted)]">
            {metric.unit}
          </span>
        )}
      </div>

      {metric.change != null && (
        <div className="mt-2 flex items-center gap-1.5">
          {/* Arrow indicator */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className={
              isPositive
                ? "text-[var(--iris-bullish)]"
                : isNegative
                  ? "text-[var(--iris-bearish)]"
                  : "text-[var(--iris-text-muted)]"
            }
          >
            {isPositive ? (
              <path
                d="M6 2L10 7H2L6 2Z"
                fill="currentColor"
              />
            ) : isNegative ? (
              <path
                d="M6 10L2 5H10L6 10Z"
                fill="currentColor"
              />
            ) : (
              <path
                d="M2 6H10"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            )}
          </svg>

          <span
            className={`font-mono text-xs font-medium ${
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

          {metric.changeLabel && (
            <span className="text-[10px] text-[var(--iris-text-muted)]">
              {metric.changeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
