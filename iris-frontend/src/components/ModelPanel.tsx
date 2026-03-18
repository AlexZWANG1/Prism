"use client";

import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { FairValueCard } from "./FairValueCard";
import { ImpliedMultiples } from "./ImpliedMultiples";
import { SensitivityHeatmap } from "./SensitivityHeatmap";
import { YearByYearTable } from "./YearByYearTable";

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[var(--iris-surface)] ${className || ""}`}
    >
      <div className="h-full w-full rounded-lg bg-gradient-to-r from-transparent via-[var(--iris-border)]/20 to-transparent" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-5">
      <ShimmerBlock className="h-56" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-10 w-28" />
        ))}
      </div>
      <ShimmerBlock className="h-48" />
      <ShimmerBlock className="h-64" />
    </div>
  );
}

export function ModelPanel() {
  const panel = useAnalysisStore((s) => s.modelPanel);

  if (panel.loading) {
    return <LoadingSkeleton />;
  }

  if (!panel.fairValue && panel.yearByYear.length === 0 && panel.impliedMultiples.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <svg
            className="mx-auto mb-4 h-10 w-10 text-[var(--iris-text-muted)]/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={0.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-[var(--iris-text-muted)]">
            等待 DCF 模型构建...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5">
      {/* Hero: Fair Value Card */}
      {panel.fairValue && <FairValueCard data={panel.fairValue} />}

      {/* Implied Multiples row */}
      {panel.impliedMultiples.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-text-muted)]">
            Implied Multiples
          </p>
          <ImpliedMultiples multiples={panel.impliedMultiples} />
        </div>
      )}

      {/* Year-by-Year Projections */}
      {panel.yearByYear.length > 0 && (
        <YearByYearTable data={panel.yearByYear} />
      )}

      {/* Sensitivity Heatmap */}
      {panel.sensitivityData.length > 0 && (
        <SensitivityHeatmap
          data={panel.sensitivityData}
          rowLabel={panel.sensitivityRowLabel}
          colLabel={panel.sensitivityColLabel}
          rowValues={panel.sensitivityRowValues}
          colValues={panel.sensitivityColValues}
        />
      )}
    </div>
  );
}
