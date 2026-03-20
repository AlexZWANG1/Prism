"use client";

import { useRef, useEffect, useMemo } from "react";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { TimelineItem } from "./TimelineItem";
import type { TimelineEvent } from "@/types/analysis";

/**
 * Extract <thinking> blocks from reasoningText and interleave them
 * with tool-call events so each thinking block appears before its
 * corresponding tool group.
 */
function interleaveThinking(
  toolEvents: TimelineEvent[],
  reasoningText: string
): TimelineEvent[] {
  if (!reasoningText) return toolEvents;

  const thinkingBlocks: string[] = [];
  const re = /<thinking>([\s\S]*?)<\/thinking>/g;
  let match;
  while ((match = re.exec(reasoningText)) !== null) {
    thinkingBlocks.push(match[1].trim());
  }

  if (thinkingBlocks.length === 0) return toolEvents;

  // Strategy: insert thinking block N before the Nth "group" of tool calls.
  // A "group" starts after a thinking block in the original LLM flow.
  // Simple heuristic: distribute thinking blocks evenly before tool calls.
  // Since thinking blocks come before tool calls sequentially, we pair them
  // by index: thinking[0] → before tools[0], thinking[1] → before the next
  // tool call that follows, etc.

  const result: TimelineEvent[] = [];
  let thinkIdx = 0;

  // Find insertion points: the first tool of each "group"
  // Heuristic: thinking block N goes before tool event N (or proportionally distributed)
  const toolsPerThinking = toolEvents.length > 0 && thinkingBlocks.length > 0
    ? Math.max(1, Math.floor(toolEvents.length / thinkingBlocks.length))
    : Infinity;

  for (let i = 0; i < toolEvents.length; i++) {
    // Insert thinking block before the corresponding tool group
    if (thinkIdx < thinkingBlocks.length && i === thinkIdx * toolsPerThinking) {
      const block = thinkingBlocks[thinkIdx];
      const firstLine = block.split("\n")[0]?.slice(0, 80) || "";
      result.push({
        id: `thinking-${thinkIdx}`,
        timestamp: toolEvents[i].timestamp - 0.001,
        tool: "thinking",
        message: firstLine,
        phase: toolEvents[i].phase,
        color: "gold",
        status: "complete",
        fullText: block,
      });
      thinkIdx++;
    }
    result.push(toolEvents[i]);
  }

  // Any remaining thinking blocks (e.g. final thinking after all tools)
  while (thinkIdx < thinkingBlocks.length) {
    const block = thinkingBlocks[thinkIdx];
    const firstLine = block.split("\n")[0]?.slice(0, 80) || "";
    const lastTs = toolEvents.length > 0
      ? toolEvents[toolEvents.length - 1].timestamp
      : Date.now();
    result.push({
      id: `thinking-${thinkIdx}`,
      timestamp: lastTs + 0.001 * thinkIdx,
      tool: "thinking",
      message: firstLine,
      phase: "finalize",
      color: "gold",
      status: "complete",
      fullText: block,
    });
    thinkIdx++;
  }

  return result;
}

export function StreamingTimeline() {
  const timeline = useAnalysisStore((s) => s.timeline);
  const reasoningText = useAnalysisStore((s) => s.reasoningText);
  const pageState = useAnalysisStore((s) => s.pageState);
  const bottomRef = useRef<HTMLDivElement>(null);

  const enrichedTimeline = useMemo(
    () => interleaveThinking(timeline, reasoningText),
    [timeline, reasoningText]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [enrichedTimeline.length]);

  if (enrichedTimeline.length === 0) {
    const isComplete = pageState === "COMPLETE";
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ padding: "6px 8px" }}
      >
        <p
          className="font-mono"
          style={{ fontSize: 12, color: "var(--iris-text-muted)" }}
        >
          {isComplete ? "无工具调用记录" : "正在初始化分析..."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ padding: "6px 8px" }}
    >
      {enrichedTimeline.map((event, idx) => (
        <TimelineItem
          key={event.id}
          event={event}
          isLast={idx === enrichedTimeline.length - 1}
        />
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
