"use client";

import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { FairValueCard } from "./FairValueCard";
import { ImpliedMultiples } from "./ImpliedMultiples";
import { SensitivityHeatmap } from "./SensitivityHeatmap";
import { YearByYearTable } from "./YearByYearTable";

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <div className="h-24 bg-[var(--iris-surface)]" />
      <div className="h-8 w-2/3 bg-[var(--iris-surface)]" />
      <div className="h-48 bg-[var(--iris-surface)]" />
      <div className="h-64 bg-[var(--iris-surface)]" />
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
      <div className="px-3 py-12">
        <p className="text-[11px] text-[var(--iris-text-muted)]">
          等待 DCF 模型构建...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {/* Fair Value Card */}
      {panel.fairValue && <FairValueCard data={panel.fairValue} />}

      {/* Implied Multiples row */}
      {panel.impliedMultiples.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--iris-text-muted)]">
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
