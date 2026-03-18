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
      <div className="flex items-center justify-center py-4">
        <p style={{ fontSize: 11, color: "var(--iris-text-muted)" }}>
          正在初始化分析...
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical connector line */}
      <div
        className="absolute bottom-0 left-[5px] top-0"
        style={{
          width: 1,
          background:
            "linear-gradient(to bottom, var(--iris-border) 0%, var(--iris-border) 100%)",
          opacity: 0.5,
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

      {/* Subtle pulse at bottom when RUNNING */}
      {pageState === "RUNNING" && (
        <div className="relative ml-[5px] h-3 overflow-hidden">
          <div
            className="absolute left-0 h-full animate-pulse"
            style={{
              width: 1,
              background:
                "linear-gradient(to bottom, var(--iris-border), transparent)",
              opacity: 0.4,
            }}
          />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
