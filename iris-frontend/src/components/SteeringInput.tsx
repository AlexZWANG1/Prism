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
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <div
        className="relative min-w-0 flex-1"
      >
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          disabled={isDisabled}
          className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            color: "var(--iris-text)",
            borderColor: isDisabled
              ? "var(--iris-border)"
              : "rgba(201,168,76,0.3)",
            ...(isDisabled
              ? {}
              : {
                  boxShadow: "0 0 0 1px rgba(201,168,76,0.05)",
                }),
          }}
          onFocus={(e) => {
            if (!isDisabled) {
              e.currentTarget.style.borderColor = "var(--iris-accent)";
              e.currentTarget.style.boxShadow =
                "0 0 0 1px rgba(201,168,76,0.15), 0 0 8px rgba(201,168,76,0.1)";
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)";
            e.currentTarget.style.boxShadow =
              "0 0 0 1px rgba(201,168,76,0.05)";
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!message.trim() || isDisabled}
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-30"
        style={{
          background:
            !message.trim() || isDisabled
              ? "var(--iris-surface)"
              : "var(--iris-accent)",
          color:
            !message.trim() || isDisabled
              ? "var(--iris-text-muted)"
              : "var(--iris-bg)",
        }}
      >
        {/* Send / arrow-up icon */}
        <svg
          className="h-4 w-4"
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
