import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IRIS - Investment Research Intelligence System",
  description: "AI-powered investment research automation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-[var(--iris-bg)] text-[var(--iris-text)] antialiased">
        {/* ─── Top Navigation ─── */}
        <nav className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-[var(--iris-accent)]/15 bg-[var(--iris-surface)]/80 px-6 backdrop-blur-xl">
          {/* Left: Logo + Links */}
          <div className="flex items-center">
            {/* IRIS Logo */}
            <a href="/" className="group flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded border border-[var(--iris-accent)]/50 bg-[var(--iris-bg)] transition-colors group-hover:border-[var(--iris-accent)]">
                <span className="font-mono text-[11px] font-bold tracking-tight text-[var(--iris-accent)]">
                  IR
                </span>
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-[var(--iris-text)]">
                IRIS
              </span>
            </a>

            {/* Nav Links */}
            <div className="ml-8 flex items-center gap-6">
              <a
                href="/"
                className="relative text-sm text-[var(--iris-text-secondary)] transition-colors duration-200 hover:text-[var(--iris-text)] after:absolute after:-bottom-[14px] after:left-0 after:h-[2px] after:w-0 after:bg-[var(--iris-accent)] after:transition-all after:duration-200 hover:after:w-full"
              >
                首页
              </a>
              <a
                href="/memory"
                className="relative text-sm text-[var(--iris-text-secondary)] transition-colors duration-200 hover:text-[var(--iris-text)] after:absolute after:-bottom-[14px] after:left-0 after:h-[2px] after:w-0 after:bg-[var(--iris-accent)] after:transition-all after:duration-200 hover:after:w-full"
              >
                记忆管理
              </a>
            </div>
          </div>

          {/* Right: Live indicator */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-[var(--iris-text-muted)]">
              LIVE
            </span>
            <div className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--iris-accent)] opacity-40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--iris-accent)]" />
            </div>
          </div>
        </nav>

        {/* ─── Main Content ─── */}
        <main>{children}</main>
      </body>
    </html>
  );
}
