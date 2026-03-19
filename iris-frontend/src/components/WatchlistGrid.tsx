"use client";

import type { WatchlistItem } from "@/types/analysis";
import { WatchlistRow } from "./WatchlistCard";

interface WatchlistGridProps {
  items: WatchlistItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function WatchlistGrid({ items, loading, onRefresh }: WatchlistGridProps) {
  return (
    <div>
      {/* Section header */}
      <div
        className="flex items-center gap-3 border-b px-2 py-1.5"
        style={{ borderColor: "var(--iris-accent)", borderBottomWidth: "1px" }}
      >
        <h2
          className="text-[13px] font-semibold tracking-wide uppercase"
          style={{ color: "var(--iris-text-secondary)" }}
        >
          监控列表
        </h2>
        <span
          className="font-data text-[11px]"
          style={{ color: "var(--iris-accent)" }}
        >
          {items.length}
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto text-[11px] px-2 py-0.5 border cursor-pointer"
          style={{
            borderColor: "var(--iris-border)",
            color: "var(--iris-text-muted)",
            borderRadius: "2px",
            backgroundColor: "transparent",
          }}
        >
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-[11px]" style={{ color: "var(--iris-text-muted)" }}>
          <div
            className="h-3 w-3 animate-spin rounded-full border border-t-transparent"
            style={{ borderColor: "var(--iris-accent)", borderTopColor: "transparent" }}
          />
          加载中...
        </div>
      ) : (
        <table className="mt-1 w-full">
          <thead>
            <tr>
              <th className="text-left text-[11px]" style={{ color: "var(--iris-text-muted)" }}>Ticker</th>
              <th className="text-left text-[11px]" style={{ color: "var(--iris-text-muted)" }}>Name</th>
              <th className="text-right text-[11px]" style={{ color: "var(--iris-text-muted)" }}>Price</th>
              <th className="text-right text-[11px]" style={{ color: "var(--iris-text-muted)" }}>Gap%</th>
              <th className="text-right text-[11px]" style={{ color: "var(--iris-text-muted)" }}>Fair Value</th>
              <th className="text-right text-[11px]" style={{ color: "var(--iris-text-muted)" }}>Rec</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <WatchlistRow key={item.ticker} item={item} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
