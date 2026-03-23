"use client";

import { useState } from "react";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import type { HypothesisData, HypothesisEvidenceCard } from "@/types/analysis";

/* ── Direction style mapping (verity-inspired) ───────────── */
const DIRECTION_STYLE: Record<
  string,
  { label: string; bg: string; color: string; border: string; icon: string }
> = {
  supports: {
    label: "支持",
    bg: "rgba(22, 163, 74, 0.08)",
    color: "var(--green)",
    border: "1px solid rgba(22, 163, 74, 0.22)",
    icon: "↗",
  },
  refutes: {
    label: "反驳",
    bg: "rgba(220, 38, 38, 0.08)",
    color: "var(--red)",
    border: "1px solid rgba(220, 38, 38, 0.22)",
    icon: "↘",
  },
  mixed: {
    label: "混合",
    bg: "rgba(217, 119, 6, 0.08)",
    color: "var(--amber)",
    border: "1px solid rgba(217, 119, 6, 0.22)",
    icon: "◎",
  },
  neutral: {
    label: "中立",
    bg: "var(--bg-2)",
    color: "var(--t3)",
    border: "1px solid var(--b1)",
    icon: "·",
  },
};

/* ── Confidence color helper ─────────────────────────────── */
function confidenceColor(c: number): string {
  if (c >= 80) return "var(--green)";
  if (c >= 50) return "var(--amber)";
  return "var(--t3)";
}

/* ── Evidence card component ─────────────────────────────── */
function EvidenceCardItem({ card }: { card: HypothesisEvidenceCard }) {
  const style = DIRECTION_STYLE[card.direction] || DIRECTION_STYLE.neutral;

  return (
    <div
      className="rounded-lg p-3"
      style={{ background: style.bg, border: style.border }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 text-[13px] font-bold leading-none"
          style={{ color: style.color }}
        >
          {style.icon}
        </span>
        <div className="min-w-0 flex-1">
          {card.evidenceText && (
            <p
              className="text-[13px] leading-[1.7] text-[var(--t1)]"
            >
              {card.evidenceText}
            </p>
          )}
          {card.reasoning && (
            <p className="mt-1 text-[12px] leading-[1.6] text-[var(--t2)]">
              {card.reasoning}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex rounded-pill px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: style.bg, color: style.color }}
            >
              {style.label}
            </span>
            {card.driverLink && (
              <span className="text-[10px] text-[var(--t3)]">
                驱动: {card.driverLink}
              </span>
            )}
            {card.delta !== 0 && (
              <span
                className="font-mono text-[10px] font-semibold"
                style={{
                  color: card.delta > 0 ? "var(--green)" : card.delta < 0 ? "var(--red)" : "var(--t3)",
                }}
              >
                {card.delta > 0 ? "+" : ""}
                {card.delta.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Single hypothesis card ──────────────────────────────── */
function HypothesisCard({ hyp }: { hyp: HypothesisData }) {
  const [expanded, setExpanded] = useState(true);

  const supportCount = hyp.evidenceLog.filter((e) => e.direction === "supports").length;
  const refuteCount = hyp.evidenceLog.filter((e) => e.direction === "refutes").length;
  const mixedCount = hyp.evidenceLog.filter((e) => e.direction === "mixed" || e.direction === "neutral").length;
  const total = hyp.evidenceLog.length;

  const supportPct = total > 0 ? (supportCount / total) * 100 : 0;
  const refutePct = total > 0 ? (refuteCount / total) * 100 : 0;

  return (
    <section className="prism-panel overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between border-b border-[var(--b1)] px-5 py-4 text-left transition-colors hover:bg-[var(--bg-hover)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--ac)]">
              H
            </span>
            <span className="font-mono text-[13px] font-semibold text-[var(--ac)]">
              {hyp.company}
            </span>
            {hyp.timeframe && (
              <span className="rounded-pill bg-[var(--bg-2)] px-2 py-0.5 text-[10px] text-[var(--t3)]">
                {hyp.timeframe}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[14px] leading-[1.7] text-[var(--t1)]">
            {hyp.thesis}
          </p>
        </div>
        <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
          <span
            className="font-mono text-[22px] font-semibold"
            style={{ color: confidenceColor(hyp.confidence) }}
          >
            {hyp.confidence.toFixed(0)}%
          </span>
          <span className="text-[10px] text-[var(--t3)]">置信度</span>
        </div>
      </button>

      {expanded && (
        <div className="space-y-5 p-5">
          {/* Confidence bar */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--t3)]">
                置信度
              </span>
              <span
                className="font-mono text-[13px] font-semibold"
                style={{ color: confidenceColor(hyp.confidence) }}
              >
                {hyp.confidence.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-2)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${hyp.confidence}%`,
                  background:
                    hyp.confidence >= 80
                      ? "var(--green)"
                      : hyp.confidence >= 50
                        ? "var(--amber)"
                        : "var(--t4)",
                }}
              />
            </div>
          </div>

          {/* Evidence balance bar */}
          {total > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--t3)]">
                  证据分布
                </span>
                <span className="font-mono text-[11px] text-[var(--t3)]">
                  {supportCount}↑ {mixedCount > 0 ? `${mixedCount}· ` : ""}{refuteCount}↓
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--bg-2)]">
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${supportPct}%`, background: "var(--green)" }}
                />
                {mixedCount > 0 && (
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${((mixedCount / total) * 100)}%`,
                      background: "var(--t4)",
                    }}
                  />
                )}
                <div
                  className="h-full transition-all duration-300"
                  style={{ width: `${refutePct}%`, background: "var(--red)" }}
                />
              </div>
            </div>
          )}

          {/* Drivers */}
          {hyp.drivers.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--t3)]">
                核心驱动因素
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {hyp.drivers.map((d) => (
                  <div
                    key={d.name}
                    className="rounded-lg bg-[var(--bg)] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-[var(--t1)]">
                        {d.name}
                      </span>
                      {d.evidenceCount > 0 && (
                        <span className="rounded-pill bg-[var(--ac-s)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ac)]">
                          {d.evidenceCount} 证据
                        </span>
                      )}
                    </div>
                    {d.description && (
                      <p className="mt-1 text-[11px] leading-[1.5] text-[var(--t2)]">
                        {d.description}
                      </p>
                    )}
                    {d.currentAssessment && (
                      <p className="mt-1 text-[11px] text-[var(--t3)]">
                        评估: {d.currentAssessment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kill criteria */}
          {hyp.killCriteria.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--red)]">
                Kill Criteria
              </div>
              <div className="space-y-1.5">
                {hyp.killCriteria.map((kc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-[12px]"
                    style={{
                      background: kc.resolved
                        ? "rgba(220, 38, 38, 0.08)"
                        : "var(--bg)",
                      color: kc.resolved ? "var(--red)" : "var(--t2)",
                    }}
                  >
                    <span className="shrink-0">
                      {kc.resolved ? "✗" : "○"}
                    </span>
                    <span className={kc.resolved ? "line-through" : ""}>
                      {kc.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence log */}
          {hyp.evidenceLog.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--t3)]">
                证据记录 ({hyp.evidenceLog.length})
              </div>
              <div className="space-y-2">
                {hyp.evidenceLog.map((card) => (
                  <EvidenceCardItem key={card.id} card={card} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Main HypothesisPanel ────────────────────────────────── */
export function HypothesisPanel() {
  const hypothesisPanel = useAnalysisStore((s) => s.hypothesisPanel);
  const pageState = useAnalysisStore((s) => s.pageState);

  if (hypothesisPanel.hypotheses.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--t4)]">
          假说面板
        </div>
        <p className="mt-2 text-[13px] text-[var(--t3)]">
          {pageState === "RUNNING"
            ? "投资假说与证据卡片将在分析过程中生成..."
            : "等待假说形成..."}
        </p>
        {pageState === "RUNNING" && (
          <div className="mt-4 flex w-full max-w-xl flex-col gap-3">
            <div className="prism-shimmer h-4 w-3/4 rounded" />
            <div className="prism-shimmer h-4 w-full rounded" />
            <div className="prism-shimmer h-4 w-5/6 rounded" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5 sm:p-6">
      {/* Summary header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--t3)]">
          投资假说
        </span>
        <span className="rounded-pill bg-[var(--ac-s)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--ac)]">
          {hypothesisPanel.hypotheses.length} 条假说
        </span>
        <span className="rounded-pill bg-[var(--bg-2)] px-2 py-0.5 font-mono text-[11px] text-[var(--t3)]">
          {hypothesisPanel.hypotheses.reduce((sum, h) => sum + h.evidenceLog.length, 0)} 条证据
        </span>
      </div>

      {/* Hypothesis cards */}
      {hypothesisPanel.hypotheses.map((hyp) => (
        <HypothesisCard key={hyp.id} hyp={hyp} />
      ))}
    </div>
  );
}
