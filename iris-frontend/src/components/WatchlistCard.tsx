"use client";

import type { WatchlistItem } from "@/types/analysis";
import { formatCurrency } from "@/utils/formatters";

interface WatchlistRowProps {
  item: WatchlistItem;
}

export function WatchlistRow({ item }: WatchlistRowProps) {
  const gapPct = item.gap != null ? item.gap * 100 : null;
  const isPositiveGap = gapPct != null && gapPct > 0;
  const isNegativeGap = gapPct != null && gapPct < 0;

  return (
    <tr
      className="cursor-pointer"
      onClick={() => {
        if (item.latest_run_id) {
          window.location.href = `/analysis/${item.latest_run_id}`;
        } else {
          window.location.href = `/analysis?query=${encodeURIComponent(item.ticker)}`;
        }
      }}
    >
      {/* Ticker */}
      <td className="text-[12px] font-bold" style={{ color: "var(--iris-text)" }}>
        {item.ticker}
      </td>

      {/* Company name */}
      <td
        className="max-w-[200px] truncate text-[11px]"
        style={{ color: "var(--iris-text-muted)" }}
      >
        {item.name ?? "—"}
      </td>

      {/* Market Price */}
      <td className="font-data text-right text-[12px]" style={{ color: "var(--iris-data)" }}>
        {item.market_price != null ? formatCurrency(item.market_price) : "—"}
      </td>

      {/* Gap % */}
      <td
        className="font-data text-right text-[12px] font-medium"
        style={{
          color: isPositiveGap
            ? "#22C55E"
            : isNegativeGap
            ? "#EF4444"
            : "var(--iris-text-secondary)",
        }}
      >
        {gapPct != null ? `${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(1)}%` : "—"}
      </td>

      {/* Fair Value */}
      <td className="font-data text-right text-[12px]" style={{ color: "var(--iris-data)" }}>
        {item.fair_value != null ? formatCurrency(item.fair_value) : "—"}
      </td>

      {/* Recommendation */}
      <td className="text-right text-[11px]" style={{ color: "var(--iris-text-secondary)" }}>
        {item.recommendation ?? "—"}
      </td>
    </tr>
  );
}
