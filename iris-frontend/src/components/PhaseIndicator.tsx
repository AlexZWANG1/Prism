"use client";

import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import type { Phase, PageState } from "@/types/analysis";

const phases: { key: Phase; label: string }[] = [
  { key: "gather", label: "收集" },
  { key: "analyze", label: "分析" },
  { key: "evaluate", label: "评估" },
  { key: "finalize", label: "总结" },
];

export function PhaseIndicator() {
  const currentPhase = useAnalysisStore((s) => s.currentPhase);
  const pageState: PageState = useAnalysisStore((s) => s.pageState);
  const currentIdx = phases.findIndex((p) => p.key === currentPhase);
  const isComplete = pageState === "COMPLETE";

  return (
    <div className="flex items-center" style={{ height: 24 }}>
      <div className="flex items-center gap-0">
        {phases.map((phase, idx) => {
          const isActive = phase.key === currentPhase && !isComplete;
          const isPast = idx < currentIdx || isComplete;

          return (
            <div key={phase.key} className="flex items-center">
              {idx > 0 && (
                <span
                  className="mx-1"
                  style={{
                    fontSize: 11,
                    color: "var(--iris-text-muted)",
                    opacity: 0.4,
                  }}
                >
                  ›
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: isActive
                    ? "#C9A84C"
                    : isPast
                      ? "var(--iris-text-secondary)"
                      : "var(--iris-text-muted)",
                  opacity: isActive ? 1 : isPast ? 0.7 : 0.3,
                }}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status on the right */}
      <div className="ml-auto flex items-center">
        {isComplete && (
          <span style={{ fontSize: 11, color: "#22C55E", fontWeight: 500 }}>
            完成
          </span>
        )}
        {pageState === "WAITING" && (
          <span style={{ fontSize: 11, color: "#C9A84C", fontWeight: 500 }}>
            等待输入
          </span>
        )}
      </div>
    </div>
  );
}
