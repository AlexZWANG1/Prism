"use client";

import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { useShallow } from "zustand/react/shallow";
import type { ActiveTab } from "@/types/analysis";

/* Minimal SVG icon paths for each tab */
const TABS: {
  key: ActiveTab;
  label: string;
  iconPath: string;
  countSelector?: (s: ReturnType<typeof useAnalysisStore.getState>) => number;
}[] = [
  {
    key: "data",
    label: "数据",
    // Table/grid icon
    iconPath:
      "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    countSelector: (s) =>
      s.dataPanel.metrics.length + s.dataPanel.financialTables.length,
  },
  {
    key: "model",
    label: "模型",
    // Calculator icon
    iconPath:
      "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    countSelector: (s) =>
      (s.modelPanel.fairValue ? 1 : 0) + s.modelPanel.yearByYear.length,
  },
  {
    key: "comps",
    label: "可比",
    // Bar chart icon
    iconPath:
      "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    countSelector: (s) => s.compsPanel.peers.length,
  },
  {
    key: "memory",
    label: "记忆",
    // Database icon
    iconPath:
      "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    countSelector: (s) => s.memoryPanel.recentRecalls.length,
  },
];

export function PanelTabBar() {
  const activeTab = useAnalysisStore((s) => s.activeTab);
  const setActiveTab = useAnalysisStore((s) => s.setActiveTab);

  /* Read all panel counts with shallow comparison to avoid infinite re-renders */
  const counts = useAnalysisStore(
    useShallow((s) => {
      const result: Record<ActiveTab, number> = {
        data: 0,
        model: 0,
        comps: 0,
        memory: 0,
      };
      for (const tab of TABS) {
        if (tab.countSelector) {
          result[tab.key] = tab.countSelector(s);
        }
      }
      return result;
    })
  );

  return (
    <div
      className="flex flex-shrink-0 border-b border-[var(--iris-border)]"
      style={{ background: "var(--iris-surface)" }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts[tab.key];

        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="group relative flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors"
            style={{
              color: isActive
                ? "var(--iris-accent)"
                : "var(--iris-text-muted)",
            }}
          >
            {/* SVG icon */}
            <svg
              className="h-4 w-4 transition-colors group-hover:text-[var(--iris-text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.iconPath} />
            </svg>

            {/* Label */}
            <span className="transition-colors group-hover:text-[var(--iris-text-secondary)]">
              {tab.label}
            </span>

            {/* Count badge */}
            {count > 0 && (
              <span
                className="ml-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold leading-tight"
                style={{
                  background: isActive
                    ? "rgba(201,168,76,0.15)"
                    : "var(--iris-surface-hover)",
                  color: isActive
                    ? "var(--iris-accent)"
                    : "var(--iris-text-muted)",
                }}
              >
                {count}
              </span>
            )}

            {/* Gold underline for active tab */}
            {isActive && (
              <div
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                style={{
                  background: "var(--iris-accent)",
                  boxShadow: "0 1px 4px rgba(201,168,76,0.3)",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
