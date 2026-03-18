"use client";

import { useState, useCallback } from "react";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";

const PLACEHOLDERS: Record<string, string> = {
  IDLE: "等待分析开始...",
  RUNNING: "引导分析方向，例如：重点关注 FCF margin...",
  WAITING: "等待回复问题...",
  COMPLETE: "分析已完成。输入新问题继续探索...",
};

export function SteeringInput() {
  const [message, setMessage] = useState("");
  const sendSteering = useAnalysisStore((s) => s.sendSteering);
  const pageState = useAnalysisStore((s) => s.pageState);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = message.trim();
      if (!trimmed) return;
      sendSteering(trimmed);
      setMessage("");
    },
    [message, sendSteering]
  );

  const isDisabled = pageState !== "RUNNING" && pageState !== "COMPLETE";
  const placeholder = PLACEHOLDERS[pageState] || PLACEHOLDERS.RUNNING;

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={placeholder}
        disabled={isDisabled}
        className="min-w-0 flex-1 border bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          height: 32,
          padding: "0 8px",
          fontSize: 12,
          color: "var(--iris-text)",
          borderColor: "var(--iris-border)",
          borderRadius: 2,
        }}
        onFocus={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.borderColor = "#C9A84C";
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--iris-border)";
        }}
      />

      <button
        type="submit"
        disabled={!message.trim() || isDisabled}
        className="flex flex-shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          width: 32,
          height: 32,
          borderRadius: 2,
          background:
            !message.trim() || isDisabled
              ? "var(--iris-surface)"
              : "#C9A84C",
          color:
            !message.trim() || isDisabled
              ? "var(--iris-text-muted)"
              : "var(--iris-bg)",
        }}
      >
        <svg
          style={{ width: 14, height: 14 }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5m0 0l-7 7m7-7l7 7" />
        </svg>
      </button>
    </form>
  );
}
