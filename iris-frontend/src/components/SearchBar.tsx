"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { startAnalysis } from "@/utils/api";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed || loading) return;

      setLoading(true);
      try {
        const res = await startAnalysis({ query: trimmed });
        router.push(`/analysis/${res.analysisId}`);
      } catch (err) {
        console.error("Failed to start analysis:", err);
        setLoading(false);
      }
    },
    [query, loading, router]
  );

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div
        className="relative flex items-center border"
        style={{
          height: "36px",
          borderRadius: "3px",
          backgroundColor: "var(--iris-surface)",
          borderColor: "var(--iris-border)",
        }}
      >
        {/* Search icon */}
        <svg
          className="ml-2.5 h-3.5 w-3.5 flex-shrink-0"
          style={{ color: "var(--iris-text-muted)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入 ticker 或公司名称..."
          className="h-full flex-1 bg-transparent px-2 text-[12px] outline-none"
          style={{
            color: "var(--iris-text)",
            caretColor: "var(--iris-accent)",
          }}
          onFocus={(e) => {
            const container = e.currentTarget.parentElement;
            if (container) container.style.borderColor = "var(--iris-accent)";
          }}
          onBlur={(e) => {
            const container = e.currentTarget.parentElement;
            if (container) container.style.borderColor = "var(--iris-border)";
          }}
          disabled={loading}
        />

        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="mr-1 flex-shrink-0 px-3 text-[11px] font-medium tracking-wide disabled:cursor-not-allowed disabled:opacity-30"
          style={{
            height: "26px",
            borderRadius: "2px",
            backgroundColor: "var(--iris-accent)",
            color: "#07080C",
          }}
        >
          {loading ? (
            <div
              className="mx-auto h-3 w-3 animate-spin rounded-full border border-t-transparent"
              style={{ borderColor: "#07080C", borderTopColor: "transparent" }}
            />
          ) : (
            "分析"
          )}
        </button>
      </div>
    </form>
  );
}
