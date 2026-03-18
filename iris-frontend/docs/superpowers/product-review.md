# IRIS Frontend Product Review

> Date: 2026-03-19
> Reviewer: AI PM (Claude)
> Method: Playwright browser automation + subjective evaluation

---

## S1 First Impression & Branding

The obsidian/gold theme (--iris-bg: #07080C, --iris-accent: #C9A84C) is distinctive and cohesive. The IRIS wordmark with gold horizontal rules creates an institutional finance terminal feel. The DM Sans + JetBrains Mono font pairing works well for data-heavy content.

**Strengths:**
- Unified dark theme with consistent gold accent language
- LIVE indicator in top-right adds professional terminal feel
- Watchlist cards with gold left border create clear visual hierarchy

**Issues found:**
- 3 of 6 watchlist cards (AMD, NVDA, TSLA) show no price data
- No gap percentage or fair value displayed on watchlist cards

## S2 Navigation & Information Architecture

| Route | Status | Notes |
|-------|--------|-------|
| `/` (Homepage) | OK | Search + Watchlist grid |
| `/analysis/[id]` | FIXED | Was crashing (Zustand infinite loop) |
| `/memory` | OK | File tree + viewer layout |

**Navigation highlights:** IRIS logo + 首页 + 记忆管理 is clean and minimal. No unnecessary links.

## S3 Analysis Page Experience

**Layout:** Left panel (440px) + right panel (flex-1) — well proportioned.

**Left panel contains:**
- Phase indicator bar (收集 → 分析 → 评估 → 总结) with active phase highlighting
- Streaming timeline with tool names, descriptions, and timestamps
- AI reasoning area (collapsible) at bottom

**Right panel contains:**
- Tab bar (数据 / 模型 / 可比 / 记忆) with SVG icons and count badges
- Panel content area switching between DataPanel, ModelPanel, CompsPanel, MemoryPanel

**SSE Streaming:** After fixing direct backend connection (bypassing Next.js proxy), events flow correctly:
- `text_delta` events populate AI reasoning text
- `tool_start` / `tool_end` events populate timeline
- `tool_end` data auto-extracts to correct panels

## S4 Data Panels

**DataPanel (数据):** Metric cards in responsive grid (股价, beta, 市值, P/E TTM, FWD P/E, EV/EBITDA, 毛利率) + financial tables (利润表, 资产负债表, 现金流量表). Teal (#2DD4BF) data accent contrasts well against dark background.

**ModelPanel (模型):** DCF fair value hero card ($121.47 vs $250.32 current, -51.5% downside), progress bar visualization, implied multiples badges, Year-by-Year projections table, sensitivity analysis heatmap.

**CompsPanel (可比):** Empty state until get_comps completes — expected behavior.

**MemoryPanel (记忆):** Calibration summary (命中/未中/准确度) + recent recalls list.

## S5 Visual Design

| Element | Score | Notes |
|---------|-------|-------|
| Color consistency | 5 | Obsidian/gold applied uniformly |
| Typography | 4 | Good hierarchy, JetBrains Mono for data |
| Spacing | 4 | Consistent padding, could use more breath |
| Dark mode | 5 | Native dark theme, no light mode needed |
| Mobile (375px) | 3 | Cards stack well, but analysis page not optimized for mobile |

## S6 Interaction Quality

| Aspect | Score | Notes |
|--------|-------|-------|
| Loading states | 4 | Gold spinner, skeleton shimmer for data panel |
| Tab switching | 4 | Instant, gold underline indicator |
| Search submit | 4 | Button shows spinner during POST |
| Empty states | 4 | Context-appropriate placeholder text per panel |
| Error handling | 2 | SSE reconnect exists but no user-visible error UI |

## S7 Overall Scores

| Dimension | Score (1-5) | Notes |
|-----------|-------------|-------|
| Visual Design | 4.5 | Distinctive, cohesive terminal aesthetic |
| Information Architecture | 4 | Clean two-panel layout, clear tab system |
| Data Display | 4 | Rich metric cards, tables, DCF visualization |
| Streaming Experience | 3.5 | Works end-to-end but timeline could be richer |
| Error Handling | 2 | No user-facing error states |
| Mobile | 2.5 | Homepage ok, analysis page needs work |
| **Overall** | **3.8** | Functional and visually polished for desktop use |

## S8 Top Improvements (Prioritized)

### P0 - Blocks core value
- [FIXED] Analysis page crashed due to Zustand infinite loop in PanelTabBar
- [FIXED] SSE events not arriving (Next.js proxy buffering)
- [FIXED] SSE parse error on undefined event data

### P1 - Impacts experience
- No user-facing error state when backend is down or SSE fails
- No analysis completion indicator (done state)
- Watchlist cards missing prices for 3/6 tickers

### P2 - Polish
- Mobile analysis page layout needs responsive treatment
- Phase indicator could animate transitions between phases
- Timeline items could show tool duration
- Steering input has no visible send button (only Enter key)

## S9 Screenshot Index

| File | Description |
|------|-------------|
| 01-homepage.png | Homepage with search + watchlist |
| 02-analysis-initial.png | Analysis page CRASH (pre-fix) |
| 03-memory-page.png | Memory management page |
| 05-mobile-home.png | Mobile viewport homepage |
| 10-analysis-fixed.png | Analysis page after Zustand fix |
| 50-t5s.png | Analysis at 5s - initializing |
| 50-t15s.png | Analysis at 15s - first data arriving |
| 50-t30s.png | Analysis at 30s - data panel populated |
| 50-t40s.png | Analysis at 40s - DCF model complete |
| 51-tab-数据.png | Data tab with metrics + financials |
| 51-tab-模型.png | Model tab with DCF + projections |
| 51-tab-可比.png | Comps tab (still loading) |
