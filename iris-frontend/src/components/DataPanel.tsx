"use client";

import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { MetricCardGrid } from "./MetricCardGrid";
import { FinancialTable } from "./FinancialTable";

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
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBlock key={i} className="h-24" />
        ))}
      </div>
      {/* Table skeleton */}
      <ShimmerBlock className="h-64" />
      <ShimmerBlock className="h-48" />
    </div>
  );
}

export function DataPanel() {
  const { metrics, financialTables, loading } = useAnalysisStore(
    (s) => s.dataPanel
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (metrics.length === 0 && financialTables.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          {/* Minimalist table icon */}
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
              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-[var(--iris-text-muted)]">
            等待数据...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5">
      {metrics.length > 0 && <MetricCardGrid metrics={metrics} />}
      {financialTables.map((table, idx) => (
        <FinancialTable key={idx} table={table} />
      ))}
    </div>
  );
}
