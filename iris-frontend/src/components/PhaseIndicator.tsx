"use client";

import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import type { Phase, PageState } from "@/types/analysis";

const phases: { key: Phase; label: string; color: string }[] = [
  { key: "gather", label: "收集", color: "var(--iris-phase-gather)" },
  { key: "analyze", label: "分析", color: "var(--iris-phase-analyze)" },
  { key: "evaluate", label: "评估", color: "var(--iris-phase-evaluate)" },
  { key: "finalize", label: "总结", color: "var(--iris-phase-finalize)" },
];

function CheckIcon({ size = 10 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function PhaseIndicator() {
  const currentPhase = useAnalysisStore((s) => s.currentPhase);
  const pageState: PageState = useAnalysisStore((s) => s.pageState);
  const currentIdx = phases.findIndex((p) => p.key === currentPhase);
  const isComplete = pageState === "COMPLETE";

  return (
    <div className="flex items-center" style={{ height: 36 }}>
      {phases.map((phase, idx) => {
        const isActive = phase.key === currentPhase && !isComplete;
        const isPast = idx < currentIdx || isComplete;

        return (
          <div key={phase.key} className="flex items-center">
            {/* Connector line before this phase (not for the first) */}
            {idx > 0 && (
              <div
                className="mx-1.5 h-px transition-all duration-500"
                style={{
                  width: 28,
                  background: isPast
                    ? "var(--iris-accent)"
                    : "var(--iris-text-muted)",
                  opacity: isPast ? 1 : 0.3,
                }}
              />
            )}

            <div className="flex items-center gap-1.5">
              {/* Dot / Check */}
              <div className="relative flex items-center justify-center">
                {isPast ? (
                  /* Completed: checkmark */
                  <div
                    className="flex h-4 w-4 items-center justify-center rounded-full"
                    style={{ background: phase.color }}
                  >
                    <span className="text-[var(--iris-bg)]">
                      <CheckIcon size={10} />
                    </span>
                  </div>
                ) : isActive ? (
                  /* Active: glowing dot with ring animation */
                  <>
                    <div
                      className="absolute h-4 w-4 animate-ping rounded-full opacity-30"
                      style={{ background: "var(--iris-accent)" }}
                    />
                    <div
                      className="relative h-2.5 w-2.5 rounded-full"
                      style={{
                        background: "var(--iris-accent)",
                        boxShadow: "0 0 8px rgba(201,168,76,0.5)",
                      }}
                    />
                  </>
                ) : (
                  /* Future: muted dot */
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ background: "var(--iris-text-muted)", opacity: 0.4 }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className="text-xs font-medium transition-colors duration-300"
                style={{
                  color: isPast
                    ? phase.color
                    : isActive
                      ? "var(--iris-accent)"
                      : "var(--iris-text-muted)",
                }}
              >
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}

      {/* Status badge on the right */}
      {isComplete && (
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-[var(--iris-bullish)]/20 bg-[var(--iris-bullish)]/10 px-2.5 py-0.5">
          <span className="text-[var(--iris-bullish)]">
            <CheckIcon size={10} />
          </span>
          <span className="text-xs font-medium text-[var(--iris-bullish)]">
            完成
          </span>
        </div>
      )}

      {pageState === "WAITING" && (
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-[var(--iris-accent)]/20 bg-[var(--iris-accent)]/10 px-2.5 py-0.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--iris-accent)]" />
          <span className="text-xs font-medium text-[var(--iris-accent)]">
            等待输入
          </span>
        </div>
      )}
    </div>
  );
}
