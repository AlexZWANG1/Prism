"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import { PhaseIndicator } from "@/components/PhaseIndicator";
import { StreamingTimeline } from "@/components/StreamingTimeline";
import { AIReasoningArea } from "@/components/AIReasoningArea";
import { SteeringInput } from "@/components/SteeringInput";
import { PendingQuestionCard } from "@/components/PendingQuestionCard";
import { PanelTabBar } from "@/components/PanelTabBar";
import { DataPanel } from "@/components/DataPanel";
import { ModelPanel } from "@/components/ModelPanel";
import { CompsPanel } from "@/components/CompsPanel";
import { MemoryPanel } from "@/components/MemoryPanel";

export default function AnalysisPage() {
  const params = useParams();
  const id = params.id as string;

  const pageState = useAnalysisStore((s) => s.pageState);
  const activeTab = useAnalysisStore((s) => s.activeTab);
  const pendingQuestion = useAnalysisStore((s) => s.pendingQuestion);

  useEffect(() => {
    useAnalysisStore.setState({ analysisId: id, pageState: "RUNNING" });
  }, [id]);

  useAnalysisStream(id);

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] flex-col bg-[var(--iris-bg)]">
      {/* Gold top-border glow when COMPLETE */}
      {pageState === "COMPLETE" && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, var(--iris-accent) 30%, var(--iris-accent) 70%, transparent 100%)",
            boxShadow: "0 0 12px 2px rgba(201,168,76,0.3), 0 0 4px 1px rgba(201,168,76,0.2)",
          }}
        />
      )}

      {/* Main content area */}
      <div className="flex min-h-0 flex-1">
        {/* Left Panel - fixed 440px */}
        <div className="flex w-[440px] flex-shrink-0 flex-col border-r border-[var(--iris-border)]">
          {/* Phase Indicator */}
          <div className="flex-shrink-0 border-b border-[var(--iris-border)] px-5 py-2.5">
            <PhaseIndicator />
          </div>

          {/* Timeline - scrollable center */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {pageState === "IDLE" ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-4 h-10 w-10 rounded-full border border-[var(--iris-border)] bg-[var(--iris-surface)] p-2.5">
                  <svg
                    className="h-full w-full text-[var(--iris-accent)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-[var(--iris-text-muted)]">
                  等待初始化...
                </p>
              </div>
            ) : (
              <StreamingTimeline />
            )}
          </div>

          {/* AI Reasoning - bottom, expandable, max 40% height */}
          <div
            className="flex-shrink-0 border-t border-[var(--iris-border)]"
            style={{ maxHeight: "40%" }}
          >
            <AIReasoningArea />
          </div>
        </div>

        {/* Right Panel - flex-1 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Tab Bar */}
          <PanelTabBar />

          {/* Panel Content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {pageState === "IDLE" ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--iris-accent)] border-t-transparent" />
                <p className="text-sm text-[var(--iris-text-muted)]">
                  准备分析面板...
                </p>
              </div>
            ) : (
              <>
                {activeTab === "data" && <DataPanel />}
                {activeTab === "model" && <ModelPanel />}
                {activeTab === "comps" && <CompsPanel />}
                {activeTab === "memory" && <MemoryPanel />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Steering Input / Pending Question - full width, glass-morphism */}
      <div
        className="flex-shrink-0 border-t border-[var(--iris-border)] px-5 py-3"
        style={{
          background: "rgba(14, 16, 23, 0.75)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        {pageState === "WAITING" && pendingQuestion ? (
          <PendingQuestionCard />
        ) : (
          <SteeringInput />
        )}
      </div>
    </div>
  );
}
