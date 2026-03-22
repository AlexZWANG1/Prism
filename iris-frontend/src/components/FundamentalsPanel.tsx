"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAnalysisStore } from "@/hooks/useAnalysisStore";

/** Extract section headings from markdown for a mini TOC */
function extractHeadings(md: string): { id: string; text: string; level: number }[] {
  const headings: { id: string; text: string; level: number }[] = [];
  const lines = md.split("\n");
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) {
      const text = m[2].replace(/\*\*/g, "").trim();
      const id = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "");
      headings.push({ id, text, level: m[1].length });
    }
  }
  return headings;
}

/** Light preprocessing to make LLM output render better as Markdown */
function enhanceMarkdown(raw: string): string {
  let md = raw;

  // Convert "Facts:" / "Views:" / "Impact:" patterns to proper headings if not already
  md = md.replace(/^(\*\*)(Facts|Views|Impact|Fact|View|结论先行|一、|二、|三、|四、|五、|六、)([^*]*)\1\s*/gm, (_, __, label, rest) => {
    return `### ${label}${rest}\n`;
  });

  // Convert standalone bold labels at start of line to h3
  md = md.replace(/^\*\*([^*]{2,40})[:：]\*\*\s*/gm, "### $1\n");

  return md;
}

export function FundamentalsPanel() {
  const { title, content, loading } = useAnalysisStore((s) => s.fundamentalsPanel);
  const pageState = useAnalysisStore((s) => s.pageState);

  const enhanced = useMemo(() => (content ? enhanceMarkdown(content) : ""), [content]);
  const headings = useMemo(() => extractHeadings(enhanced), [enhanced]);

  if (!content) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--t4)]">
          研究面板
        </div>
        <p className="mt-2 text-[13px] text-[var(--t3)]">
          {pageState === "RUNNING"
            ? "深度研究进行中，报告将在研究完成后出现..."
            : "等待研究产出..."}
        </p>
        {pageState === "RUNNING" && (
          <div className="mt-4 flex flex-col gap-3 w-full max-w-xl">
            <div className="prism-shimmer h-4 w-3/4 rounded" />
            <div className="prism-shimmer h-4 w-full rounded" />
            <div className="prism-shimmer h-4 w-5/6 rounded" />
            <div className="prism-shimmer h-4 w-2/3 rounded" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Mini TOC sidebar — only show if we have headings */}
      {headings.length > 2 && (
        <nav className="hidden w-48 shrink-0 overflow-y-auto border-r border-[var(--b1)] bg-[var(--bg-2)] lg:block">
          <div className="px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--t4)]">
              目录
            </div>
          </div>
          {headings.map((h, idx) => (
            <a
              key={`${h.id}-${idx}`}
              href={`#${h.id}`}
              className="block px-3 py-1.5 text-[12px] leading-[1.5] text-[var(--t2)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--ac)]"
              style={{ paddingLeft: `${(h.level - 1) * 12 + 12}px` }}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(h.id);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {h.text.slice(0, 40)}
            </a>
          ))}
        </nav>
      )}

      {/* Content area */}
      <article className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-8 sm:px-10">
          {title && (
            <h1 className="mb-6 font-display text-[22px] font-medium leading-tight tracking-[-0.02em] text-[var(--ink)]">
              {title}
            </h1>
          )}
          <div className="prose-iris">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children, ...props }) => {
                  const id = String(children).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-");
                  return <h1 id={id} {...props}>{children}</h1>;
                },
                h2: ({ children, ...props }) => {
                  const id = String(children).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-");
                  return <h2 id={id} {...props}>{children}</h2>;
                },
                h3: ({ children, ...props }) => {
                  const id = String(children).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-");
                  return <h3 id={id} {...props}>{children}</h3>;
                },
              }}
            >
              {enhanced}
            </ReactMarkdown>
          </div>
        </div>
      </article>
    </div>
  );
}
