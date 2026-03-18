"use client";

import Link from "next/link";
import type { WatchlistItem } from "@/types/analysis";
import { formatCurrency } from "@/utils/formatters";

interface WatchlistCardProps {
  item: WatchlistItem;
}

export function WatchlistCard({ item }: WatchlistCardProps) {
  const gapPct = item.gap != null ? item.gap * 100 : null;
  const isPositive = gapPct != null && gapPct > 0;
  const isNegative = gapPct != null && gapPct < 0;

  return (
    <Link
      href={`/analysis?query=${encodeURIComponent(item.ticker)}`}
      className="group relative block overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(201,168,76,0.08)]"
      style={{
        backgroundColor: "var(--iris-surface)",
        borderColor: "var(--iris-border)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(201, 168, 76, 0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--iris-border)";
      }}
    >
      {/* Gold left accent border */}
      <div
        className="absolute left-0 top-0 h-full w-[3px] transition-opacity duration-300 group-hover:opacity-100"
        style={{
          backgroundColor: "var(--iris-accent)",
          opacity: 0.5,
        }}
      />

      <div className="p-5 pl-6">
        {/* Header: Ticker + Gap */}
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3
              className="text-lg font-bold tracking-wide transition-colors duration-200"
              style={{ color: "var(--iris-text)" }}
            >
              <span className="group-hover:text-[var(--iris-accent)] transition-colors duration-200">
                {item.ticker}
              </span>
            </h3>
            {item.thesis && (
              <p
                className="mt-1 line-clamp-1 text-xs"
                style={{ color: "var(--iris-text-muted)" }}
              >
                {item.thesis}
              </p>
            )}
          </div>

          {gapPct != null && (
            <span
              className="ml-3 flex-shrink-0 text-xl font-bold tabular-nums"
              style={{
                color: isPositive
                  ? "var(--iris-bullish)"
                  : isNegative
                  ? "var(--iris-bearish)"
                  : "var(--iris-text)",
              }}
            >
              {gapPct >= 0 ? "+" : ""}
              {gapPct.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Prices row */}
        <div
          className="mb-3 flex items-center gap-6 border-t pt-3"
          style={{ borderColor: "var(--iris-border)" }}
        >
          {item.fair_value != null && (
            <div>
              <span
                className="block text-[10px] font-medium uppercase tracking-wider"
                style={{ color: "var(--iris-text-muted)" }}
              >
                公允价值
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "var(--iris-data)" }}
              >
                {formatCurrency(item.fair_value)}
              </span>
            </div>
          )}
          {item.market_price != null && (
            <div>
              <span
                className="block text-[10px] font-medium uppercase tracking-wider"
                style={{ color: "var(--iris-text-muted)" }}
              >
                市场价格
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "var(--iris-text)" }}
              >
                {formatCurrency(item.market_price)}
              </span>
            </div>
          )}
        </div>

        {/* Alerts */}
        {item.alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.alerts.map((alert, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  backgroundColor:
                    alert.type === "critical"
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(245, 158, 11, 0.1)",
                  color:
                    alert.type === "critical" ? "#f87171" : "#fbbf24",
                }}
              >
                {alert.message}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
