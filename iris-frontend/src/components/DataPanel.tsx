"use client";

import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { MetricCardGrid } from "./MetricCardGrid";
import { FinancialTable } from "./FinancialTable";

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-1 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-[var(--iris-surface)]" />
        ))}
      </div>
      <div className="h-64 bg-[var(--iris-surface)]" />
      <div className="h-48 bg-[var(--iris-surface)]" />
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
      <div className="px-3 py-12">
        <p className="text-[11px] text-[var(--iris-text-muted)]">
          等待数据...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {metrics.length > 0 && <MetricCardGrid metrics={metrics} />}
      {financialTables.map((table, idx) => (
        <FinancialTable key={idx} table={table} />
      ))}
    </div>
  );
}
