"use client";

import type { DCFAssumption } from "@/types/analysis";

interface AssumptionListProps {
  assumptions: DCFAssumption[];
}

export function AssumptionList({ assumptions }: AssumptionListProps) {
  if (assumptions.length === 0) return null;

  return (
    <div className="border border-[var(--iris-border)] rounded-[3px] overflow-hidden">
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-2 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--iris-text-muted)]">
          核心假设
        </span>
      </div>
      <div>
        {assumptions.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between px-2 py-1 text-[12px] ${
              idx < assumptions.length - 1 ? "border-b border-[var(--iris-border)]/30" : ""
            }`}
          >
            <span className="text-[var(--iris-text-secondary)]">
              {item.label}
              {item.sensitivity && (
                <span className="ml-1 text-[10px] text-amber-400">*</span>
              )}
            </span>
            <span className="font-['JetBrains_Mono',monospace] text-[#2DD4BF]">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
