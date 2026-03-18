"use client";

import type { TimelineEvent } from "@/types/analysis";
import { formatTime, formatDuration } from "@/utils/formatters";

interface TimelineItemProps {
  event: TimelineEvent;
  isLast: boolean;
}

const phaseColorMap: Record<string, string> = {
  gather: "var(--iris-phase-gather)",
  analyze: "var(--iris-phase-analyze)",
  evaluate: "var(--iris-phase-evaluate)",
  finalize: "var(--iris-phase-finalize)",
};

export function TimelineItem({ event, isLast }: TimelineItemProps) {
  const dotColor = phaseColorMap[event.phase] || "var(--iris-text-muted)";
  const isRunning = event.status === "running";
  const isError = event.status === "error";

  return (
    <div
      className="group relative flex items-start gap-3 rounded-md px-1 py-1 transition-colors hover:bg-[var(--iris-surface-hover)]"
      style={{ minHeight: 32 }}
    >
      {/* Dot on the gold thread line */}
      <div className="relative z-10 mt-1.5 flex w-[16px] flex-shrink-0 items-center justify-center">
        {isError ? (
          /* Error: red dot with X */
          <div className="flex h-[8px] w-[8px] items-center justify-center rounded-full bg-[var(--iris-bearish)]">
            <svg
              width={6}
              height={6}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--iris-bg)"
              strokeWidth={4}
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </div>
        ) : isRunning ? (
          /* Running: pulsing dot with ring */
          <div className="relative flex items-center justify-center">
            <div
              className="absolute h-[14px] w-[14px] animate-ping rounded-full opacity-25"
              style={{ background: dotColor }}
            />
            <div
              className="h-[8px] w-[8px] rounded-full"
              style={{
                background: dotColor,
                boxShadow: `0 0 6px ${dotColor}`,
              }}
            />
          </div>
        ) : (
          /* Complete: solid dot */
          <div
            className="h-[8px] w-[8px] rounded-full"
            style={{ background: dotColor }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5">
        {/* Tool name in teal */}
        {event.tool && event.tool !== "system" && event.tool !== "analysis_complete" && (
          <span
            className="flex-shrink-0 text-xs font-medium"
            style={{ color: "var(--iris-data)" }}
          >
            {event.tool}
          </span>
        )}

        {/* Message text */}
        <span
          className="min-w-0 flex-1 truncate text-xs"
          style={{
            color: isError
              ? "var(--iris-bearish)"
              : "var(--iris-text-secondary)",
          }}
        >
          {event.message}
        </span>

        {/* Duration badge */}
        {event.duration != null && (
          <span
            className="flex-shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium"
            style={{
              background: "var(--iris-surface)",
              color: "var(--iris-text-muted)",
              border: "1px solid var(--iris-border)",
            }}
          >
            {formatDuration(event.duration)}
          </span>
        )}

        {/* Timestamp */}
        <span
          className="flex-shrink-0 font-mono text-[10px]"
          style={{ color: "var(--iris-text-muted)" }}
        >
          {formatTime(event.timestamp)}
        </span>
      </div>
    </div>
  );
}
