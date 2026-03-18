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
    iconPath:
      "M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    countSelector: (s) =>
      s.dataPanel.metrics.length + s.dataPanel.financialTables.length,
  },
  {
    key: "model",
    label: "模型",
    iconPath:
      "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
    countSelector: (s) =>
      (s.modelPanel.fairValue ? 1 : 0) + s.modelPanel.yearByYear.length,
  },
  {
    key: "comps",
    label: "可比",
    iconPath:
      "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    countSelector: (s) => s.compsPanel.peers.length,
  },
  {
    key: "memory",
    label: "记忆",
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
            className="relative flex items-center gap-1 px-3 py-1.5"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: isActive
                ? "#C9A84C"
                : "var(--iris-text-muted)",
            }}
          >
            {/* SVG icon - 14px */}
            <svg
              style={{ width: 14, height: 14 }}
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
            <span>{tab.label}</span>

            {/* Count badge - tiny inline */}
            {count > 0 && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  color: isActive
                    ? "#C9A84C"
                    : "var(--iris-text-muted)",
                  opacity: 0.7,
                }}
              >
                {count}
              </span>
            )}

            {/* 1px gold bottom border for active tab - no glow */}
            {isActive && (
              <div
                className="absolute bottom-0 left-1 right-1"
                style={{
                  height: 1,
                  background: "#C9A84C",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
