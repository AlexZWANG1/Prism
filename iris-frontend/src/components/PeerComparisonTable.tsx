"use client";

import type { PeerCompany } from "@/types/analysis";
import { formatNumber } from "@/utils/formatters";

interface PeerComparisonTableProps {
  peers: PeerCompany[];
}

export function PeerComparisonTable({ peers }: PeerComparisonTableProps) {
  if (peers.length === 0) return null;

  // First peer with isTarget or just the first one as the "target" for highlighting
  const targetTicker =
    peers.find((p) => (p as Record<string, unknown>).isTarget)?.ticker ??
    peers[0]?.ticker;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--iris-border)]">
      <div className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)] px-5 py-3">
        <h3 className="text-sm font-semibold text-[var(--iris-accent)]">
          Peer Comparison
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--iris-border)] bg-[var(--iris-surface)]">
              <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Ticker
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Mkt Cap
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                P/E
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                EV/EBITDA
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Rev Growth
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-[var(--iris-accent)]">
                Margin
              </th>
            </tr>
          </thead>
          <tbody>
            {peers.map((peer, idx) => {
              const isTarget = peer.ticker === targetTicker;
              const isEven = idx % 2 === 0;

              return (
                <tr
                  key={peer.ticker}
                  className={`border-b border-[var(--iris-border)]/50 last:border-0 transition-colors hover:bg-[var(--iris-surface-hover)] ${
                    isEven ? "bg-transparent" : "bg-[var(--iris-surface)]/20"
                  }`}
                >
                  {/* Left gold border for target company */}
                  <td
                    className={`px-5 py-2.5 ${isTarget ? "border-l-2 border-l-[var(--iris-accent)]" : ""}`}
                  >
                    <div>
                      <span
                        className={`font-medium ${
                          isTarget
                            ? "text-[var(--iris-accent)]"
                            : "text-[var(--iris-text)]"
                        }`}
                      >
                        {peer.ticker}
                      </span>
                      {peer.name && peer.name !== peer.ticker && (
                        <p className="text-[10px] text-[var(--iris-text-muted)]">
                          {peer.name}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--iris-text-secondary)]">
                    {peer.marketCap > 0 ? formatNumber(peer.marketCap) : "--"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--iris-text-secondary)]">
                    {peer.peRatio > 0 ? `${peer.peRatio.toFixed(1)}x` : "--"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--iris-text-secondary)]">
                    {peer.evEbitda > 0 ? `${peer.evEbitda.toFixed(1)}x` : "--"}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono ${
                      peer.revenueGrowth >= 0
                        ? "text-[var(--iris-bullish)]"
                        : "text-[var(--iris-bearish)]"
                    }`}
                  >
                    {peer.revenueGrowth >= 0 ? "+" : ""}
                    {peer.revenueGrowth.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-[var(--iris-text-secondary)]">
                    {peer.margin.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
