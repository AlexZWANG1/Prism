"use client";

import { useState, useEffect } from "react";
import { SearchBar } from "@/components/SearchBar";
import { WatchlistGrid } from "@/components/WatchlistGrid";
import type { WatchlistItem } from "@/types/analysis";
import { getWatchlist } from "@/utils/api";

export default function HomePage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getWatchlist();
        setWatchlist(data);
      } catch {
        setError("无法加载追踪列表");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--iris-bg)" }}>
      {/* Search bar — compact, top-aligned */}
      <div className="mx-auto max-w-5xl px-4 pt-3 pb-2">
        <SearchBar />
      </div>

      {/* Watchlist Section */}
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
        ) : watchlist.length > 0 ? (
          <WatchlistGrid items={watchlist} />
        ) : (
          <div
            className="mt-2 border border-dashed px-4 py-6 text-[12px]"
            style={{
              borderColor: "var(--iris-border)",
              color: "var(--iris-text-muted)",
              borderRadius: "2px",
            }}
          >
            尚未追踪任何标的。在上方搜索栏输入 ticker 或公司名称，启动你的第一次深度分析。
          </div>
        )}
      </div>
    </div>
  );
}
