"use client";

import { useState, useRef, useEffect } from "react";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";

type ViewMode = "reasoning" | "thinking";

export function AIReasoningArea() {
  const reasoningText = useAnalysisStore((s) => s.reasoningText);
  const thinkingText = useAnalysisStore((s) => s.thinkingText);
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("reasoning");
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeText = viewMode === "thinking" ? thinkingText : reasoningText;

  // Auto-scroll to bottom when expanded and new content arrives
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeText, expanded]);

  if (!reasoningText && !thinkingText) return null;

  const lines = activeText.split("\n");
  const lineCount = lines.length;
  const previewLines = lines.slice(-2).join("\n");

  const thinkingRounds = thinkingText
    ? thinkingText.split("---").filter((s) => s.trim()).length
    : 0;

  return (
    <div className="relative flex flex-col">
      {/* Header / Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-5 py-2.5 text-left transition-colors hover:bg-[var(--iris-surface-hover)]"
      >
        {/* Gold chevron */}
        <svg
          className="h-3 w-3 flex-shrink-0 transition-transform duration-200"
          style={{
            color: "var(--iris-accent)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>

        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--iris-accent)" }}
        >
          AI 推理过程
        </span>

        {/* Line count indicator */}
        <span
          className="rounded-full px-1.5 py-px text-[10px] font-medium"
          style={{
            background: "var(--iris-surface)",
            color: "var(--iris-text-muted)",
            border: "1px solid var(--iris-border)",
          }}
        >
          {lineCount} 行
        </span>
      </button>

      {/* Tab switcher — only when expanded and thinking exists */}
      {expanded && thinkingText && (
        <div className="flex gap-1 px-5 pb-2">
          <button
            onClick={(e) => { e.stopPropagation(); setViewMode("reasoning"); }}
            className="rounded px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              background: viewMode === "reasoning" ? "var(--iris-accent)" : "var(--iris-surface)",
              color: viewMode === "reasoning" ? "var(--iris-bg)" : "var(--iris-text-muted)",
              border: `1px solid ${viewMode === "reasoning" ? "var(--iris-accent)" : "var(--iris-border)"}`,
            }}
          >
            分析输出
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setViewMode("thinking"); }}
            className="rounded px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              background: viewMode === "thinking" ? "var(--iris-accent)" : "var(--iris-surface)",
              color: viewMode === "thinking" ? "var(--iris-bg)" : "var(--iris-text-muted)",
              border: `1px solid ${viewMode === "thinking" ? "var(--iris-accent)" : "var(--iris-border)"}`,
            }}
          >
            AI 思考链 ({thinkingRounds})
          </button>
        </div>
      )}

      {/* Content area */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? "calc(40vh - 44px)" : 52,
        }}
      >
        <div className="relative">
          {/* Left border — gold for reasoning, blue for thinking */}
          {expanded && (
            <div
              className="absolute bottom-0 left-0 top-0 w-[2px]"
              style={{
                background: viewMode === "thinking" ? "#60a5fa" : "var(--iris-accent)",
                opacity: 0.5,
              }}
            />
          )}

          <div
            ref={scrollRef}
            className={`px-5 pb-3 ${expanded ? "overflow-y-auto" : "overflow-hidden"}`}
            style={{
              maxHeight: expanded ? "calc(40vh - 44px)" : 52,
            }}
          >
            <pre
              className="whitespace-pre-wrap font-mono text-xs leading-relaxed"
              style={{
                color: viewMode === "thinking" && expanded
                  ? "#93c5fd"
                  : "var(--iris-text-secondary)",
              }}
            >
              {expanded ? activeText : previewLines}
            </pre>
          </div>

          {/* Fade-out gradient when collapsed */}
          {!expanded && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
              style={{
                background:
                  "linear-gradient(to top, var(--iris-bg) 0%, transparent 100%)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
