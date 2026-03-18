"use client";

import type { WatchlistItem } from "@/types/analysis";
import { WatchlistCard } from "./WatchlistCard";

interface WatchlistGridProps {
  items: WatchlistItem[];
}

export function WatchlistGrid({ items }: WatchlistGridProps) {
  return (
    <div>
      {/* Section header */}
      <div className="mb-8 flex items-center gap-4">
        <div
          className="h-px w-8"
          style={{ backgroundColor: "var(--iris-accent)" }}
        />
        <h2
          className="text-lg font-semibold tracking-wide"
          style={{ color: "var(--iris-text)" }}
        >
          监控列表
        </h2>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums"
          style={{
            backgroundColor: "rgba(201, 168, 76, 0.1)",
            color: "var(--iris-accent)",
          }}
        >
          {items.length}
        </span>
        <div
          className="h-px flex-1"
          style={{ backgroundColor: "var(--iris-border)" }}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <WatchlistCard key={item.ticker} item={item} />
        ))}
      </div>
    </div>
  );
}
