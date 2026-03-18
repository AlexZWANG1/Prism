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
    <form onSubmit={handleSubmit} className="relative mx-auto w-full max-w-[640px]">
      <div
        className="relative rounded-2xl border backdrop-blur-md transition-all duration-300 focus-within:shadow-[0_0_24px_rgba(201,168,76,0.12)]"
        style={{
          backgroundColor: "rgba(14, 16, 23, 0.8)",
          borderColor: "var(--iris-border)",
        }}
      >
        {/* Search icon */}
        <svg
          className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors duration-200"
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
          className="w-full bg-transparent py-4 pl-14 pr-32 text-base outline-none placeholder:transition-colors"
          style={{
            color: "var(--iris-text)",
            caretColor: "var(--iris-accent)",
          }}
          disabled={loading}
        />

        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-6 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-30"
          style={{
            backgroundColor: "var(--iris-accent)",
            color: "#ffffff",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = "var(--iris-accent-hover)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--iris-accent)";
          }}
        >
          {loading ? (
            <div
              className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "#ffffff", borderTopColor: "transparent" }}
            />
          ) : (
            "分析"
          )}
        </button>
      </div>

      {/* Focus-state gold border overlay via CSS */}
      <style jsx>{`
        form:focus-within .relative {
          border-color: var(--iris-accent) !important;
        }
      `}</style>
    </form>
  );
}
