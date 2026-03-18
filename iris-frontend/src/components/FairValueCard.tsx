"use client";

import type { FairValueData } from "@/types/analysis";
import { formatCurrency } from "@/utils/formatters";

interface FairValueCardProps {
  data: FairValueData;
}

const confidenceConfig = {
  high: {
    label: "高置信",
    color: "text-[var(--iris-bullish)]",
    bg: "bg-[var(--iris-bullish)]/10",
    border: "border-[var(--iris-bullish)]/30",
  },
  medium: {
    label: "中置信",
    color: "text-[var(--iris-accent)]",
    bg: "bg-[var(--iris-accent)]/10",
    border: "border-[var(--iris-accent)]/30",
  },
  low: {
    label: "低置信",
    color: "text-[var(--iris-bearish)]",
    bg: "bg-[var(--iris-bearish)]/10",
    border: "border-[var(--iris-bearish)]/30",
  },
};

export function FairValueCard({ data }: FairValueCardProps) {
  const conf = confidenceConfig[data.confidence];
  const isUpside = data.upside >= 0;

  // Calculate position percentages for the visual bar
  const maxVal = Math.max(data.fairValue, data.currentPrice) * 1.2;
  const fairPct = Math.min(95, Math.max(5, (data.fairValue / maxVal) * 100));
  const currentPct = Math.min(
    95,
    Math.max(5, (data.currentPrice / maxVal) * 100)
  );

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--iris-accent)]/30 p-6"
      style={{
        background:
          "linear-gradient(145deg, rgba(14,16,23,0.95) 0%, rgba(14,16,23,0.7) 100%)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 0 40px rgba(201,168,76,0.06), inset 0 1px 0 rgba(201,168,76,0.08)",
      }}
    >
      {/* Gold glow effect at top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--iris-accent) 50%, transparent 100%)",
          opacity: 0.4,
        }}
      />

      {/* Header row: label + confidence badge */}
      <div className="mb-5 flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]/70">
          DCF Fair Value
        </p>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${conf.color} ${conf.bg} ${conf.border}`}
        >
          {conf.label}
        </span>
      </div>

      {/* Main value row */}
      <div className="mb-6 flex items-end gap-4">
        <div>
          <p className="font-mono text-4xl font-bold text-[var(--iris-accent)]">
            {formatCurrency(data.fairValue, data.currency)}
          </p>
        </div>
        <div className="mb-1 flex items-baseline gap-3">
          <span className="font-mono text-lg text-[var(--iris-text-secondary)]">
            {formatCurrency(data.currentPrice, data.currency)}
          </span>
          <span className="text-xs text-[var(--iris-text-muted)]">current</span>
        </div>
      </div>

      {/* Upside/downside percentage */}
      <div className="mb-6">
        <span
          className={`font-mono text-3xl font-bold ${
            isUpside
              ? "text-[var(--iris-bullish)]"
              : "text-[var(--iris-bearish)]"
          }`}
        >
          {isUpside ? "+" : ""}
          {data.upside.toFixed(1)}%
        </span>
        <span className="ml-2 text-sm text-[var(--iris-text-muted)]">
          {isUpside ? "upside" : "downside"}
        </span>
      </div>

      {/* Visual bar: fair value vs current price */}
      <div className="relative mb-2">
        <div className="h-2 overflow-hidden rounded-full bg-[var(--iris-border)]">
          {/* Background fill to fair value */}
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
            style={{
              width: `${fairPct}%`,
              background: isUpside
                ? "linear-gradient(90deg, var(--iris-bullish), var(--iris-accent))"
                : "linear-gradient(90deg, var(--iris-bearish), var(--iris-accent))",
              opacity: 0.3,
            }}
          />
        </div>

        {/* Current price marker */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${currentPct}%` }}
        >
          <div className="h-4 w-1 rounded-full bg-[var(--iris-text-secondary)]" />
        </div>

        {/* Fair value marker */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${fairPct}%` }}
        >
          <div
            className="h-4 w-1.5 rounded-full bg-[var(--iris-accent)]"
            style={{ boxShadow: "0 0 6px var(--iris-accent)" }}
          />
        </div>
      </div>

      {/* Bar labels */}
      <div className="flex justify-between text-[10px] text-[var(--iris-text-muted)]">
        <span>
          {data.currency} 0
        </span>
        <div className="flex gap-4">
          <span className="text-[var(--iris-text-secondary)]">
            Current: {formatCurrency(data.currentPrice, data.currency)}
          </span>
          <span className="text-[var(--iris-accent)]">
            Fair: {formatCurrency(data.fairValue, data.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
