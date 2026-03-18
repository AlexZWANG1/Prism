"use client";

import type { WatchlistItem } from "@/types/analysis";
import { WatchlistRow } from "./WatchlistCard";

interface WatchlistGridProps {
  items: WatchlistItem[];
}

export function WatchlistGrid({ items }: WatchlistGridProps) {
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
      </div>

      {/* Table */}
      <table className="mt-1">
        <thead>
          <tr>
            <th className="text-left text-[11px]">Ticker</th>
            <th className="text-left text-[11px]">Name</th>
            <th className="text-right text-[11px]">Price</th>
            <th className="text-right text-[11px]">Gap%</th>
            <th className="text-right text-[11px]">Fair Value</th>
            <th className="text-right text-[11px]">Alerts</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <WatchlistRow key={item.ticker} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
