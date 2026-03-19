# IRIS Data Persistence & UI Redesign

**Date:** 2026-03-19
**Status:** Approved (pending implementation)

## Problem Statement

The IRIS platform has a "one-shot" problem: analysis results exist only in browser memory during the SSE stream and are permanently lost when the page closes. The backend has well-designed Pydantic models and SQLite tables (`valuations`, `hypotheses`, `trade_scores`, `audit_trails`) that are never written to. Meanwhile, the watchlist uses fragile regex extraction from free-text markdown files, frequently failing to parse fair_value, thesis, and market_price.

### Issues Identified (7 anti-patterns)

1. `save_memory` stores free-text md → regex re-extracts fair_value (circular, fragile)
2. `valuations` table exists but is dead code — never written by `build_dcf`
3. `hypotheses` table has structured thesis/confidence but watchlist doesn't read it
4. `audit_trails` table has full analysis snapshots but no API endpoint
5. `trade_scores` table has recommendations but frontend doesn't display them
6. SSE tool_end results are the only panel data source — lost when browser closes
7. `harness.run_log` writes to SQLite but has no API

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Persistence granularity | Full snapshot (timeline + panels + reasoning + thinking) | Enough to reproduce the complete analysis page |
| Homepage layout | Vertical split (watchlist top, history bottom) | Simple, both visible at once |
| Price refresh | Parallel all tickers + refresh button | 6 tickers ~2-3s, simple implementation |
| Thinking display | Inline in Timeline as collapsible entries | Shows causal relationship (thought → tool call) |
| Regex cleanup scope | Full — activate all dead tables | Eliminate all regex extraction, connect structured data end-to-end |
| Watchlist row click | Open most recent analysis replay | Natural intent is "see last analysis", not "re-run" |

## Architecture

### New Table: `analysis_runs`

```sql
CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    ticker TEXT,
    status TEXT NOT NULL,         -- 'complete' | 'error'
    created_at TEXT NOT NULL,     -- ISO 8601
    reasoning_text TEXT,
    thinking_text TEXT,
    timeline_json TEXT,           -- JSON array of timeline events
    panels_json TEXT,             -- JSON object {data, model, comps, memory}
    recommendation TEXT,          -- WATCH/CANDIDATE/HIGH_CONVICTION/etc, nullable
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_ticker ON analysis_runs(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created ON analysis_runs(created_at DESC);
```

### Schema Migrations for Existing Tables

The `valuations` table currently has no `ticker` column (only `id` and `data`). The `trade_scores` table has no `ticker` column either (only `id`, `hypothesis_id`, `data`). Both need a `ticker` column for direct watchlist queries:

```sql
-- Added to _init_db() alongside CREATE TABLE IF NOT EXISTS
-- SQLite ALTER TABLE is safe — adds column with NULL default to existing rows
ALTER TABLE valuations ADD COLUMN ticker TEXT;
ALTER TABLE trade_scores ADD COLUMN ticker TEXT;
CREATE INDEX IF NOT EXISTS idx_valuations_ticker ON valuations(ticker);
CREATE INDEX IF NOT EXISTS idx_trade_scores_ticker ON trade_scores(ticker);
```

The `ALTER TABLE` calls should be wrapped in try/except to handle the case where columns already exist (idempotent migration). The `ValuationOutput` Pydantic model does not need a `ticker` field — the ticker is stored as a table column alongside the JSON `data` blob, matching the existing pattern used by `hypotheses` (which has `company` column + `data`).

### Activate Existing Dead Tables

These tables already exist in `retrieval.py` with full CRUD methods. Changes needed:

#### Issue 1: `build_dcf` → `save_valuation` type mismatch

`build_dcf` (iris/skills/dcf/tools.py:114) is a **pure function** — it takes `assumptions: dict` and returns `ToolResult.ok(dict)`. It has no `retriever` parameter and no access to the DB. Its return dict has fields like `fair_value_per_share`, `gap_pct`, `year_by_year` — which do NOT match the `ValuationOutput` Pydantic model (which has `fair_value_range`, `valuation_gap`, `key_assumptions`, etc.).

**Fix:** Do NOT modify `build_dcf` itself. Instead, persist valuation data at the **session accumulator level** in `api.py`'s `on_event`. When a `tool_end` event for `build_dcf` arrives, the accumulator extracts the structured result and writes a lightweight valuation record:

```python
# In session.accumulate() — when tool == "build_dcf" and status == "ok":
retriever.save_valuation_record(
    ticker=result["ticker"],           # from assumptions passed through
    fair_value=result["fair_value_per_share"],
    current_price=result["current_price"],
    gap_pct=result["gap_pct"],
    run_id=session.id,
)
```

This requires a **new** `save_valuation_record()` method on `SQLiteRetriever` that writes directly to the `valuations` table with the new `ticker` column, WITHOUT requiring a `ValuationOutput` Pydantic model. The existing `save_valuation()` / `ValuationOutput` pattern is over-engineered for what we need — a simple `(id, ticker, fair_value, data_json)` row suffices.

Similarly, the `register()` function in `iris/skills/dcf/tools.py:495` must pass `context["retriever"]` to the tool — but since we're handling this at the accumulator level, no change to `register()` is needed.

#### Issue 2: `trade_scores` — recommendation data link is broken

`trade_scores` has `save_trade_score()` (retrieval.py:182) but **nothing calls it**. The `TradeScore` model requires `hypothesis_id`, `raw_score`, `constrained_score`, `recommendation`, etc. — these are produced by a `generate_trade_signal` flow that doesn't exist yet.

**Fix for this iteration:** Do NOT try to wire up `trade_scores` now. Instead, add a `recommendation` column directly to `analysis_runs`:

```sql
ALTER TABLE analysis_runs ADD COLUMN recommendation TEXT;  -- WATCH/CANDIDATE/etc, nullable
```

The recommendation is extracted from the AI's reasoning text at analysis completion. Specifically, the harness result's `reply` text is parsed by a simple heuristic in the accumulator (look for explicit recommendation keywords in the final output, or default to NULL). This is NOT regex on markdown files — it's parsing the AI's own structured conclusion which follows the soul's output format.

Watchlist reads `recommendation` from `analysis_runs` instead of `trade_scores`. The `trade_scores` table activation is deferred to a future iteration when the full trade signal pipeline is built.

#### Issue 3: `save_audit_trail` cannot be populated from current completion data

`AuditTrail` (schemas.py:149) requires 15+ fields including `documents_used`, `observations_extracted`, `evidence_supporting`, `evidence_refuting`, `belief_trajectory`, `raw_trade_score`, `constrained_trade_score`, etc. The harness completion callback (api.py:145) only has `reply`, `error`, `tokens`, `tool_log`.

**Fix:** Defer `audit_trails` activation. The `analysis_runs` table already captures everything needed for history/replay. `audit_trails` is a richer analytical structure that requires the full hypothesis/evidence/trade-score pipeline to be wired first. Trying to fill it with placeholder data defeats the purpose.

Remove `save_audit_trail()` from the completion flow. Add it back when the hypothesis → evidence → trade score pipeline is fully connected in a future iteration.

#### Summary of what actually gets activated this iteration:

| Table | Status | Rationale |
|-------|--------|-----------|
| `analysis_runs` | **NEW — fully wired** | Core persistence, enables history + replay |
| `valuations` | **Activated (simplified)** | New `save_valuation_record()` writes fair_value from build_dcf results at accumulator level |
| `hypotheses` | **Already active** | `create_hypothesis` already calls `save_hypothesis()` |
| `trade_scores` | **Deferred** | No caller exists; recommendation goes in analysis_runs instead |
| `audit_trails` | **Deferred** | Required fields cannot be populated from current completion data |

- **`create_hypothesis`** → already calls `retriever.save_hypothesis()` (confirmed in `iris/skills/hypothesis/tools.py:172,232`). No change needed.
- **`add_evidence_card`** → already updates hypothesis evidence_log in `iris/skills/hypothesis/tools.py`. No change needed.

### Data Flow (After)

```
User submits query
  → POST /api/analyze → session created → SSE stream starts
  │
  │  on_event callback fires for every HarnessEvent:
  │    ├─ SSE path: harness_event_to_sse() → truncated → browser queue
  │    └─ Accumulator path: session.accumulate_raw(event) → full data
  │
  ├─ Each tool call → SSE push + accumulator captures full result
  ├─ <thinking> blocks → SSE push + accumulated as timeline thinking entries
  ├─ build_dcf() → SSE push + accumulator extracts fair_value
  │                          → retriever.save_valuation_record(ticker, fair_value, ...)
  ├─ create_hypothesis() → SSE push + retriever.save_hypothesis() (already wired)
  ├─ get_comps() → SSE push + accumulated in session
  ├─ save_memory() → writes md note (free text only, no regex extraction)
  │
  ▼ Analysis complete
  ├─ db.save_analysis_run() (full snapshot from session accumulator, untruncated)
  ├─ calibration entry (reads fair_value from valuations table, not regex)
  └─ SSE: analysis_complete → done
```

### Server-Side Session Accumulator

`AnalysisSession` gains an accumulator that mirrors what the frontend collects from SSE:

```python
@dataclass
class AnalysisSession:
    # ... existing fields ...

    # New: server-side accumulator
    accumulated_timeline: list[dict] = field(default_factory=list)
    accumulated_reasoning: str = ""
    accumulated_thinking: str = ""
    accumulated_panels: dict = field(default_factory=dict)
```

`sse_bridge.py`'s `harness_event_to_sse()` remains a pure function (event → dict). The accumulation happens in `api.py`'s `on_event` callback, which already has access to the session object.

**Critical: Accumulator reads raw HarnessEvent, NOT the SSE-converted dict.**

`sse_bridge.py` truncates `tool_end.result` to 10KB (sse_bridge.py:16, `_MAX_RESULT_SIZE`). If the accumulator consumed the SSE dict, panel data snapshots would be truncated — defeating the "full snapshot" design.

**Fix:** The accumulator reads from the raw `HarnessEvent.data` (which has the full untruncated result), while the SSE queue gets the truncated version for browser delivery:

```python
# In api.py start_analysis()
def on_event(event: HarnessEvent) -> None:
    # SSE path: truncated for browser
    sse = harness_event_to_sse(event)
    if sse is not None:
        session.events.put(sse)
        session.touch()
    # Accumulator path: reads raw event with full data
    session.accumulate_raw(event)  # NEW: uses HarnessEvent, not SSE dict
```

`session.accumulate_raw(event)` processes the raw `HarnessEvent` — for `TOOL_END` events it reads the full `event.data["result"]` without truncation. For `TEXT_DELTA` events it accumulates reasoning/thinking text. For `TOOL_START` events it builds timeline entries.

This avoids changing `harness_event_to_sse()`'s signature while ensuring the snapshot has complete data.

### API Changes

#### New Endpoints

**`GET /api/history?ticker=AAPL&limit=30&offset=0`**

Returns paginated list of analysis runs. All query params optional.

```json
{
  "items": [
    {
      "id": "abc123def456",
      "query": "分析 NVDA 在 AI 基础设施赛道的投资机会",
      "ticker": "NVDA",
      "status": "complete",
      "created_at": "2026-03-19T10:30:00Z",
      "tokens_in": 8500,
      "tokens_out": 3800
    }
  ],
  "total": 42,
  "limit": 30,
  "offset": 0
}
```

**`GET /api/history/{run_id}`**

Returns full snapshot for replay. The response shape matches what `loadSnapshot()` expects on the frontend.

```json
{
  "id": "abc123def456",
  "query": "分析 NVDA",
  "ticker": "NVDA",
  "status": "complete",
  "created_at": "2026-03-19T10:30:00Z",
  "reasoning_text": "...",
  "thinking_text": "...",
  "timeline": [
    {"id": "tool-yf_quote-1710...", "timestamp": 1710..., "tool": "yf_quote", "message": "...", "phase": "gather", "color": "green", "status": "complete"},
    {"id": "thinking-1710...", "tool": "thinking", "message": "preview...", "fullText": "...", "phase": "gather", "color": "gold", "status": "complete"}
  ],
  "panels": {
    "data": {"metrics": [...], "financialTables": [...]},
    "model": {"fairValue": {...}, "sensitivityData": [...], ...},
    "comps": {"peers": [...], "scatterData": [...]},
    "memory": {"calibrationHits": 0, "calibrationMisses": 0, "recentRecalls": [...]}
  },
  "tokens_in": 8500,
  "tokens_out": 3800
}
```

#### Modified Endpoints

| Endpoint | Change |
|----------|--------|
| `GET /api/watchlist` | Rewrite: DB for fair_value/thesis/recommendation + parallel yf_quote for live price/name |
| `GET /api/calibration` | Read fair_value from valuations table instead of regex |

#### Deleted Code

- `api.py`: `_parse_company_file()`, `_extract_number()`, `_extract_section()`, `_compute_alerts()`, `_extract_kill_section()`, `_check_calibration_warning()` — all regex-based parsers
- `memory.py`: `_extract_fair_value()` — regex extraction
- `memory.py`: `_append_calibration_entry()` regex logic — replaced with DB read. The new implementation queries `valuations` table for the latest `predicted` value for the ticker. If no valuation exists (e.g., `build_dcf` was never called), no calibration entry is created — this is correct behavior since there's nothing to calibrate.

### Watchlist Data Sources (After)

| Field | Source | Mechanism |
|-------|--------|-----------|
| ticker | `analysis_runs` + `hypotheses` | Deduplicated set of all analyzed tickers |
| name | `yf_quote()` | Real-time, parallel on page load |
| market_price | `yf_quote()` | Real-time, parallel on page load |
| fair_value | `valuations` table | Latest record for ticker |
| gap | Computed | `(fair_value - market_price) / market_price` |
| thesis | `hypotheses` table | Latest record's `thesis` field |
| recommendation | `analysis_runs` table | `recommendation` column from latest run for this ticker (trade_scores deferred) |
| alerts | Computed from DB | Kill criteria from hypotheses + staleness from analysis_runs |
| latest_run_id | `analysis_runs` table | Most recent run_id for this ticker (for click → replay) |

## Frontend Changes

### Homepage (`/`)

**Layout:** Search bar + refresh button → Watchlist table → History list

**Data loading:**
- Page load → parallel `GET /api/watchlist` + `GET /api/history`
- Refresh button → re-fetch `/api/watchlist` with loading state

**Interactions:**
- Click watchlist row → navigate to `/analysis/{latest_run_id}` (replay mode). If no analysis exists, show prompt.
- Click history row → navigate to `/analysis/{run_id}` (replay mode)
- Search bar submit → `POST /api/analyze` → navigate to `/analysis/{new_id}` (live mode)

### Analysis Page (`/analysis/[id]`) — Dual Mode

**Mode detection — fetch-first, not SSE-first:**

The original design proposed "try SSE, on 404 fallback to history." This is unreliable because `EventSource.onerror` does not expose HTTP status codes (iris-frontend/src/hooks/useAnalysisStream.ts:68) — you cannot distinguish 404 from a network error.

**Fix:** Use a **fetch-first probe** before opening EventSource:

```typescript
// In useAnalysisStream or analysis page
const probe = await fetch(`/api/analyze/${id}/stream`, { method: 'HEAD' });
if (probe.status === 404) {
  // No active session → load snapshot
  const snapshot = await getHistoryDetail(id);
  if (snapshot) {
    loadSnapshot(snapshot);  // replay mode
  } else {
    // ID doesn't exist anywhere → show error
  }
} else {
  // Active session exists → open EventSource for live streaming
  connectSSE(id);
}
```

This gives a clean HTTP status code from `fetch()` before committing to EventSource. The `/api/analyze/{id}/stream` endpoint already returns 404 when session is not found (api.py:185), so HEAD works naturally.

Alternatively, add a dedicated lightweight endpoint `GET /api/analyze/{id}/status` that returns `{"exists": true, "status": "running"}` or 404. This avoids HEAD semantics issues with SSE endpoints.

**Replay mode differences:**
- Top banner: "历史回看 — {date} {query}"
- Bottom SteeringInput hidden
- All other components identical (same panels, timeline, reasoning area)

### Timeline — Thinking Entries

Thinking blocks become first-class timeline items:

```typescript
// New timeline event type
{
    id: "thinking-{timestamp}",
    timestamp: number,
    tool: "thinking",        // special type
    message: "数据够了，准备构建 DCF...",  // first line as preview
    fullText: "...",         // complete thinking block
    phase: currentPhase,
    color: "gold",           // distinct from tool colors
    status: "complete",
    collapsed: true,         // default collapsed
}
```

**Rendering:** Gold left border, "AI 思考" label, click to expand/collapse.

**SSE parsing change:** `handleSSEEvent` for `text_delta` detects `<thinking>` boundaries and emits timeline thinking entries in addition to accumulating thinkingText.

### Store Changes (`useAnalysisStore`)

New action:
```typescript
loadSnapshot: (snapshot: AnalysisSnapshot) => void
// Populates timeline, reasoningText, thinkingText, all panels from snapshot
// Sets pageState to "COMPLETE"
```

## Key Invariant: Session ID = analysis_runs ID

The `session.id` (generated in `sessions.py` as `uuid.uuid4().hex[:16]`) is reused as the `analysis_runs.id`. This is critical because:

1. `POST /api/analyze` returns `analysisId` (= session.id) to the frontend
2. Frontend navigates to `/analysis/{analysisId}` and connects SSE via session.id
3. When analysis completes, `analysis_runs` is written with `id = session.id`
4. Later, `/analysis/{same_id}` can fall back to `GET /api/history/{same_id}`

If these IDs diverged, the dual-mode detection on the analysis page would break.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Browser closes mid-analysis | Backend continues, session accumulator captures all data, writes to DB on completion |
| Backend crashes mid-analysis | analysis_runs not written (writes on completion). Analysis lost. Acceptable — no regression from current behavior |
| build_dcf not called (macro question) | valuations empty, watchlist shows "—" for fair_value. analysis_runs still recorded |
| Same ticker analyzed multiple times | Watchlist shows latest fair_value/thesis. History shows all runs. All versions preserved in DB |
| yf_quote fails for some tickers | Those rows show "—" for price/name, others display normally. Non-blocking |
| First use, empty DB | Watchlist empty with guide text. History section hidden |
| analysis_runs snapshot is large | panels_json may be large for complex analyses. Acceptable — SQLite handles multi-MB TEXT fields fine. Consider VACUUM schedule if DB grows past 100MB |

## Files to Modify

### Backend
- `iris/backend/api.py` — rewrite watchlist endpoint, add history endpoints, delete regex functions
- `iris/backend/sessions.py` — add accumulator fields to AnalysisSession
- `iris/backend/sse_bridge.py` — no change needed (accumulation happens in api.py's on_event callback)
- `iris/tools/memory.py` — delete `_extract_fair_value`, change calibration to read from DB
- `iris/tools/retrieval.py` — add `analysis_runs` table to `_init_db`, add `ticker` column to `valuations` (ALTER TABLE with try/except for idempotency), add `save_valuation_record()` simplified method, add save/query methods for analysis_runs
- `iris/skills/dcf/tools.py` — NO change (valuation persistence happens at accumulator level in api.py, not in tool)
- `iris/skills/hypothesis/tools.py` — already calls `save_hypothesis()`, no change needed
- `iris/core/harness.py` — NO change this iteration (audit_trails deferred)

### Frontend
- `iris-frontend/src/app/page.tsx` — new layout with watchlist + history sections + refresh button
- `iris-frontend/src/app/analysis/[id]/page.tsx` — dual mode (live vs replay), replay banner
- `iris-frontend/src/hooks/useAnalysisStore.ts` — add loadSnapshot action, thinking timeline entries
- `iris-frontend/src/hooks/useAnalysisStream.ts` — add 404 fallback to snapshot loading
- `iris-frontend/src/components/StreamingTimeline.tsx` — render thinking entries (collapsible, gold)
- `iris-frontend/src/components/TimelineItem.tsx` — new thinking item variant
- `iris-frontend/src/components/WatchlistGrid.tsx` — add name, recommendation columns
- `iris-frontend/src/components/WatchlistCard.tsx` — fix click behavior, add recommendation display
- `iris-frontend/src/utils/api.ts` — add getHistory, getHistoryDetail, updated getWatchlist
- `iris-frontend/src/types/analysis.ts` — add AnalysisSnapshot, ThinkingTimelineEvent types

### Delete
- All regex parsing functions in `api.py` and `memory.py` (listed above)
