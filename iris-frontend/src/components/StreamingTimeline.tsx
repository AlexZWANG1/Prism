"use client";

import { useRef, useEffect } from "react";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { TimelineItem } from "./TimelineItem";

export function StreamingTimeline() {
  const timeline = useAnalysisStore((s) => s.timeline);
  const pageState = useAnalysisStore((s) => s.pageState);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline.length]);

  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--iris-accent)] border-t-transparent" />
        <p className="text-sm text-[var(--iris-text-muted)]">
          正在初始化分析...
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical gold thread line */}
      <div
        className="absolute bottom-0 left-[7px] top-0 w-[2px]"
        style={{
          background:
            "linear-gradient(to bottom, var(--iris-accent) 0%, var(--iris-border) 100%)",
          opacity: 0.4,
        }}
      />

      {/* Timeline items */}
      <div className="relative">
        {timeline.map((event, idx) => (
          <TimelineItem
            key={event.id}
            event={event}
            isLast={idx === timeline.length - 1}
          />
        ))}
      </div>

      {/* Shimmer at bottom when RUNNING */}
      {pageState === "RUNNING" && (
        <div className="relative ml-[7px] h-6 overflow-hidden">
          <div
            className="absolute left-0 h-full w-[2px] animate-pulse"
            style={{
              background:
                "linear-gradient(to bottom, var(--iris-accent), transparent)",
              opacity: 0.6,
            }}
          />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
