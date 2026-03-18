"use client";

import { useState, useRef, useEffect } from "react";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";

export function AIReasoningArea() {
  const reasoningText = useAnalysisStore((s) => s.reasoningText);
  const thinkingText = useAnalysisStore((s) => s.thinkingText);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Always show reasoning text only
  const activeText = reasoningText;

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

  return (
    <div className="relative flex flex-col">
      {/* Header / Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left"
        style={{ background: "transparent" }}
      >
        {/* Muted chevron */}
        <svg
          className="flex-shrink-0"
          style={{
            width: 10,
            height: 10,
            color: "var(--iris-text-muted)",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 150ms",
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
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--iris-text-secondary)",
            letterSpacing: "0.03em",
          }}
        >
          分析笔记
        </span>

        {/* Line count */}
        <span
          style={{
            fontSize: 9,
            color: "var(--iris-text-muted)",
          }}
        >
          {lineCount}行
        </span>
      </button>

      {/* Content area */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: expanded ? "calc(40vh - 36px)" : 36,
          transition: "max-height 200ms ease-in-out",
        }}
      >
        <div className="relative">
          {/* Left border accent */}
          {expanded && (
            <div
              className="absolute bottom-0 left-0 top-0"
              style={{
                width: 1,
                background: "var(--iris-border)",
                opacity: 0.6,
              }}
            />
          )}

          <div
            ref={scrollRef}
            className={`px-3 pb-2 ${expanded ? "overflow-y-auto" : "overflow-hidden"}`}
            style={{
              maxHeight: expanded ? "calc(40vh - 36px)" : 36,
            }}
          >
            <pre
              className="whitespace-pre-wrap font-mono"
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                color: "var(--iris-text-secondary)",
              }}
            >
              {expanded ? activeText : previewLines}
            </pre>
          </div>

          {/* Fade-out gradient when collapsed */}
          {!expanded && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{
                height: 16,
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
