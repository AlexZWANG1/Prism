"use client";

import { useState, useCallback } from "react";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";

export function PendingQuestionCard() {
  const pendingQuestion = useAnalysisStore((s) => s.pendingQuestion);
  const respondToInput = useAnalysisStore((s) => s.respondToInput);
  const [customResponse, setCustomResponse] = useState("");

  const handleOptionClick = useCallback(
    (option: string) => {
      respondToInput(option);
    },
    [respondToInput]
  );

  const handleCustomSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = customResponse.trim();
      if (!trimmed) return;
      respondToInput(trimmed);
      setCustomResponse("");
    },
    [customResponse, respondToInput]
  );

  if (!pendingQuestion) return null;

  return (
    <div className="flex items-start gap-2 border-l-2 border-l-[var(--event-user)] bg-[var(--iris-surface)] px-2 py-1.5">
      <span className="shrink-0 text-[11px] font-semibold text-[var(--event-user)]">Q</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-[var(--iris-text)]">
          {pendingQuestion.question}
        </p>

        {pendingQuestion.context && (
          <p className="mt-0.5 text-[10px] text-[var(--iris-text-muted)]">
            {pendingQuestion.context}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1">
          {pendingQuestion.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleOptionClick(option)}
              className="rounded-[2px] border border-[var(--iris-border)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--iris-text-secondary)] hover:border-[var(--iris-accent)] hover:text-[var(--iris-text)]"
            >
              {option}
            </button>
          ))}

          <form onSubmit={handleCustomSubmit} className="flex items-center gap-1 flex-1 min-w-[120px]">
            <input
              type="text"
              value={customResponse}
              onChange={(e) => setCustomResponse(e.target.value)}
              placeholder="自定义回复..."
              className="flex-1 rounded-[2px] border border-[var(--iris-border)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--iris-text)] placeholder:text-[var(--iris-text-muted)] focus:border-[var(--iris-accent)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!customResponse.trim()}
              className="rounded-[2px] bg-[var(--event-user)] px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-30"
            >
              回复
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
