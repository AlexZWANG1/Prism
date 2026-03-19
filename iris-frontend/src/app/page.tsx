"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchBar } from "@/components/SearchBar";
import { WatchlistGrid } from "@/components/WatchlistGrid";
import type { WatchlistItem, HistoryItem } from "@/types/analysis";
import { getWatchlist, getHistory } from "@/utils/api";

const STATUS_COLORS: Record<string, string> = {
  complete: "#22C55E",
  running: "#3B82F6",
  error: "#EF4444",
  pending: "#A3A3A3",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
    + " " + d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function HomePage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [wlLoading, setWlLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [wl, hist] = await Promise.all([getWatchlist(), getHistory()]);
        setWatchlist(wl);
        setHistory(hist.items);
      } catch {
        setError("无法加载数据");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRefresh = useCallback(async () => {
    setWlLoading(true);
    try {
      const wl = await getWatchlist();
      setWatchlist(wl);
    } catch {
      // silent
    } finally {
      setWlLoading(false);
    }
  }, []);

  const isEmpty = watchlist.length === 0 && history.length === 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--iris-bg)" }}>
      {/* Search bar */}
      <div className="mx-auto max-w-5xl px-4 pt-3 pb-2">
        <SearchBar />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-8">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-[11px]" style={{ color: "var(--iris-text-muted)" }}>
            <div
              className="h-3 w-3 animate-spin rounded-full border border-t-transparent"
              style={{ borderColor: "var(--iris-accent)", borderTopColor: "transparent" }}
            />
            加载中...
          </div>
        ) : error ? (
          <div
            className="mt-2 border px-3 py-2 text-[12px]"
            style={{
              borderColor: "rgba(239, 68, 68, 0.3)",
              backgroundColor: "rgba(239, 68, 68, 0.05)",
              color: "#f87171",
              borderRadius: "2px",
            }}
          >
            {error}
          </div>
        ) : isEmpty ? (
          <div
            className="mt-2 border border-dashed px-4 py-6 text-[12px]"
            style={{
              borderColor: "var(--iris-border)",
              color: "var(--iris-text-muted)",
              borderRadius: "2px",
            }}
          >
            尚未有任何分析记录。在上方搜索栏输入 ticker 或公司名称，启动你的第一次深度分析。
          </div>
        ) : (
          <>
            {/* Watchlist */}
            {watchlist.length > 0 && (
              <WatchlistGrid items={watchlist} loading={wlLoading} onRefresh={handleRefresh} />
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="mt-6">
                <div
                  className="flex items-center gap-3 border-b px-2 py-1.5"
                  style={{ borderColor: "var(--iris-accent)", borderBottomWidth: "1px" }}
                >
                  <h2
                    className="text-[13px] font-semibold tracking-wide uppercase"
                    style={{ color: "var(--iris-text-secondary)" }}
                  >
                    历史分析
                  </h2>
                  <span className="font-data text-[11px]" style={{ color: "var(--iris-accent)" }}>
                    {history.length}
                  </span>
                </div>

                <table className="mt-1 w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] py-1 px-1" style={{ color: "var(--iris-text-muted)" }}>日期</th>
                      <th className="text-left text-[11px] py-1 px-1" style={{ color: "var(--iris-text-muted)" }}>查询</th>
                      <th className="text-left text-[11px] py-1 px-1" style={{ color: "var(--iris-text-muted)" }}>Ticker</th>
                      <th className="text-left text-[11px] py-1 px-1" style={{ color: "var(--iris-text-muted)" }}>状态</th>
                      <th className="text-right text-[11px] py-1 px-1" style={{ color: "var(--iris-text-muted)" }}>Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer hover:opacity-80"
                        style={{ borderBottom: "1px solid var(--iris-border)" }}
                        onClick={() => {
                          window.location.href = `/analysis/${item.id}`;
                        }}
                      >
                        <td className="font-data text-[11px] py-1 px-1" style={{ color: "var(--iris-text-muted)" }}>
                          {formatDate(item.created_at)}
                        </td>
                        <td className="text-[12px] py-1 px-1 max-w-[260px] truncate" style={{ color: "var(--iris-text)" }}>
                          {item.query}
                        </td>
                        <td className="font-data text-[12px] py-1 px-1 font-bold" style={{ color: "var(--iris-text)" }}>
                          {item.ticker ?? "—"}
                        </td>
                        <td className="py-1 px-1">
                          <span
                            className="inline-block text-[10px] px-1.5 py-0.5 font-medium"
                            style={{
                              color: STATUS_COLORS[item.status] || "#A3A3A3",
                              backgroundColor: `${STATUS_COLORS[item.status] || "#A3A3A3"}15`,
                              borderRadius: "2px",
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="font-data text-right text-[11px] py-1 px-1" style={{ color: "var(--iris-text-muted)" }}>
                          {(item.tokens_in + item.tokens_out).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
