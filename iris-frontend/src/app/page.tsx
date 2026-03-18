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
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center px-6 pt-24 pb-16">
        <div className="mb-2 flex items-center gap-3">
          <div
            className="h-px w-12"
            style={{ backgroundColor: "var(--iris-accent)", opacity: 0.4 }}
          />
          <h1
            className="text-6xl font-bold tracking-[0.25em]"
            style={{ color: "var(--iris-accent)" }}
          >
            IRIS
          </h1>
          <div
            className="h-px w-12"
            style={{ backgroundColor: "var(--iris-accent)", opacity: 0.4 }}
          />
        </div>
        <p
          className="mb-12 text-sm font-light tracking-[0.2em] uppercase"
          style={{ color: "var(--iris-text-secondary)" }}
        >
          Investment Research Intelligence System
        </p>

        <SearchBar />
      </div>

      {/* Watchlist Section */}
      <div className="mx-auto max-w-6xl px-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--iris-accent)", borderTopColor: "transparent" }}
            />
          </div>
        ) : error ? (
          <div
            className="mx-auto max-w-md rounded-xl border px-6 py-8 text-center text-sm"
            style={{
              borderColor: "rgba(239, 68, 68, 0.2)",
              backgroundColor: "rgba(239, 68, 68, 0.05)",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        ) : watchlist.length > 0 ? (
          <WatchlistGrid items={watchlist} />
        ) : (
          <div
            className="mx-auto max-w-md rounded-xl border border-dashed px-8 py-20 text-center"
            style={{ borderColor: "var(--iris-border)" }}
          >
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--iris-surface)" }}
            >
              <svg
                className="h-6 w-6"
                style={{ color: "var(--iris-text-muted)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
                />
              </svg>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--iris-text-muted)" }}
            >
              尚未追踪任何标的。在上方搜索栏输入 ticker 或公司名称，启动你的第一次深度分析。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
