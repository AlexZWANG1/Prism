# Data Persistence & UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist analysis results to SQLite so they survive page closes, add history/replay, replace all regex extraction with structured DB reads, and add live Yahoo Finance prices to the watchlist.

**Architecture:** Backend-first approach. Tasks 1-4 build the persistence layer (DB schema, session accumulator, API endpoints). Tasks 5-8 rebuild the frontend (homepage, analysis page dual-mode, thinking timeline, types/API client). Each task produces a working commit.

**Tech Stack:** Python/FastAPI/SQLite (backend), Next.js 15/React 19/Zustand/TypeScript (frontend), yfinance for live prices.

**Spec:** `docs/superpowers/specs/2026-03-19-data-persistence-and-ui-redesign.md`

---

### Task 1: DB Schema — analysis_runs table + valuations ticker column

**Files:**
- Modify: `iris/tools/retrieval.py`
- Test: `iris/tests/test_retrieval_persistence.py` (create)

This task adds the `analysis_runs` table and the `ticker` column migration for `valuations`. No behavior changes yet — just schema and CRUD methods.

- [ ] **Step 1: Write failing tests for new DB methods**

Create `iris/tests/test_retrieval_persistence.py`:

```python
"""Tests for analysis_runs persistence and valuation_record saving."""
import json
import pytest
from tools.retrieval import SQLiteRetriever


@pytest.fixture
def retriever(tmp_path):
    db_path = str(tmp_path / "test.db")
    return SQLiteRetriever(db_path)


class TestAnalysisRuns:
    def test_save_and_get_analysis_run(self, retriever):
        retriever.save_analysis_run(
            id="run-001",
            query="分析 NVDA",
            ticker="NVDA",
            status="complete",
            reasoning_text="AI analysis output",
            thinking_text="AI thinking process",
            timeline_json=json.dumps([{"tool": "yf_quote", "status": "complete"}]),
            panels_json=json.dumps({"data": {"metrics": []}}),
            recommendation="CANDIDATE",
            tokens_in=5000,
            tokens_out=2000,
        )
        run = retriever.get_analysis_run("run-001")
        assert run is not None
        assert run["ticker"] == "NVDA"
        assert run["status"] == "complete"
        assert run["recommendation"] == "CANDIDATE"
        assert run["tokens_in"] == 5000

    def test_get_nonexistent_run_returns_none(self, retriever):
        assert retriever.get_analysis_run("nonexistent") is None

    def test_list_analysis_runs(self, retriever):
        for i in range(5):
            retriever.save_analysis_run(
                id=f"run-{i:03d}",
                query=f"分析 TEST{i}",
                ticker="NVDA" if i % 2 == 0 else "AAPL",
                status="complete",
                reasoning_text="",
                thinking_text="",
                timeline_json="[]",
                panels_json="{}",
                tokens_in=100,
                tokens_out=50,
            )
        # All runs
        result = retriever.list_analysis_runs(limit=10, offset=0)
        assert result["total"] == 5
        assert len(result["items"]) == 5

        # Filter by ticker
        result = retriever.list_analysis_runs(ticker="NVDA", limit=10, offset=0)
        assert result["total"] == 3

        # Pagination
        result = retriever.list_analysis_runs(limit=2, offset=0)
        assert len(result["items"]) == 2

    def test_get_latest_run_for_ticker(self, retriever):
        # NOTE: Use rowid DESC as tiebreaker since created_at may be same-second
        retriever.save_analysis_run(
            id="old", query="old", ticker="NVDA", status="complete",
            reasoning_text="", thinking_text="", timeline_json="[]",
            panels_json="{}", tokens_in=0, tokens_out=0,
        )
        retriever.save_analysis_run(
            id="new", query="new", ticker="NVDA", status="complete",
            reasoning_text="", thinking_text="", timeline_json="[]",
            panels_json="{}", tokens_in=0, tokens_out=0,
        )
        latest = retriever.get_latest_run_for_ticker("NVDA")
        assert latest is not None
        assert latest["id"] == "new"


class TestValuationRecord:
    def test_save_and_get_valuation_record(self, retriever):
        retriever.save_valuation_record(
            ticker="NVDA",
            fair_value=119.35,
            current_price=181.85,
            gap_pct=-34.1,
            run_id="run-001",
        )
        val = retriever.get_latest_valuation("NVDA")
        assert val is not None
        assert val["fair_value"] == 119.35
        assert val["ticker"] == "NVDA"

    def test_get_latest_valuation_returns_newest(self, retriever):
        retriever.save_valuation_record(
            ticker="NVDA", fair_value=100.0, current_price=180.0,
            gap_pct=-44.0, run_id="run-old",
        )
        retriever.save_valuation_record(
            ticker="NVDA", fair_value=119.35, current_price=181.85,
            gap_pct=-34.1, run_id="run-new",
        )
        val = retriever.get_latest_valuation("NVDA")
        assert val["fair_value"] == 119.35

    def test_get_tracked_tickers(self, retriever):
        retriever.save_analysis_run(
            id="r1", query="q", ticker="NVDA", status="complete",
            reasoning_text="", thinking_text="", timeline_json="[]",
            panels_json="{}", tokens_in=0, tokens_out=0,
        )
        retriever.save_analysis_run(
            id="r2", query="q", ticker="AAPL", status="complete",
            reasoning_text="", thinking_text="", timeline_json="[]",
            panels_json="{}", tokens_in=0, tokens_out=0,
        )
        tickers = retriever.get_tracked_tickers()
        assert set(tickers) == {"NVDA", "AAPL"}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd iris && python -m pytest tests/test_retrieval_persistence.py -v`
Expected: FAIL — methods don't exist yet.

- [ ] **Step 3: Implement schema migration + CRUD methods in retrieval.py**

Add to `SQLiteRetriever._init_db()` after existing CREATE TABLE statements:

```python
# --- analysis_runs table ---
conn.execute("""
    CREATE TABLE IF NOT EXISTS analysis_runs (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        ticker TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        reasoning_text TEXT,
        thinking_text TEXT,
        timeline_json TEXT,
        panels_json TEXT,
        recommendation TEXT,
        tokens_in INTEGER DEFAULT 0,
        tokens_out INTEGER DEFAULT 0
    );
""")
conn.execute("CREATE INDEX IF NOT EXISTS idx_analysis_runs_ticker ON analysis_runs(ticker);")
conn.execute("CREATE INDEX IF NOT EXISTS idx_analysis_runs_created ON analysis_runs(created_at DESC);")

# --- ticker column migration for valuations ---
try:
    conn.execute("ALTER TABLE valuations ADD COLUMN ticker TEXT")
except Exception:
    pass  # column already exists
try:
    conn.execute("CREATE INDEX IF NOT EXISTS idx_valuations_ticker ON valuations(ticker)")
except Exception:
    pass
```

Add these methods to `SQLiteRetriever`:

```python
# --- analysis_runs methods ---

def save_analysis_run(self, *, id: str, query: str, ticker: str | None,
                      status: str, reasoning_text: str, thinking_text: str,
                      timeline_json: str, panels_json: str,
                      recommendation: str | None = None,
                      tokens_in: int = 0, tokens_out: int = 0) -> None:
    with self._conn() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO analysis_runs
               (id, query, ticker, status, reasoning_text, thinking_text,
                timeline_json, panels_json, recommendation, tokens_in, tokens_out)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (id, query, ticker, status, reasoning_text, thinking_text,
             timeline_json, panels_json, recommendation, tokens_in, tokens_out),
        )

def get_analysis_run(self, run_id: str) -> dict | None:
    with self._conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM analysis_runs WHERE id = ?", (run_id,)
        ).fetchone()
    return dict(row) if row else None

def list_analysis_runs(self, *, ticker: str | None = None,
                       limit: int = 30, offset: int = 0) -> dict:
    with self._conn() as conn:
        if ticker:
            total = conn.execute(
                "SELECT COUNT(*) FROM analysis_runs WHERE UPPER(ticker) = UPPER(?)",
                (ticker,),
            ).fetchone()[0]
            rows = conn.execute(
                "SELECT id, query, ticker, status, created_at, recommendation, tokens_in, tokens_out "
                "FROM analysis_runs WHERE UPPER(ticker) = UPPER(?) "
                "ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (ticker, limit, offset),
            ).fetchall()
        else:
            total = conn.execute("SELECT COUNT(*) FROM analysis_runs").fetchone()[0]
            rows = conn.execute(
                "SELECT id, query, ticker, status, created_at, recommendation, tokens_in, tokens_out "
                "FROM analysis_runs ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
    return {
        "items": [dict(zip(
            ["id", "query", "ticker", "status", "created_at", "recommendation", "tokens_in", "tokens_out"],
            row,
        )) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }

def get_latest_run_for_ticker(self, ticker: str) -> dict | None:
    with self._conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM analysis_runs WHERE UPPER(ticker) = UPPER(?) ORDER BY created_at DESC, rowid DESC LIMIT 1",
            (ticker,),
        ).fetchone()
    return dict(row) if row else None

# --- valuation_record methods ---

def save_valuation_record(self, *, ticker: str, fair_value: float,
                          current_price: float, gap_pct: float,
                          run_id: str) -> None:
    import json as _json
    val_id = f"{ticker}-{run_id}"
    data = _json.dumps({
        "fair_value": fair_value,
        "current_price": current_price,
        "gap_pct": gap_pct,
        "run_id": run_id,
    })
    with self._conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO valuations (id, data, ticker) VALUES (?, ?, ?)",
            (val_id, data, ticker.upper()),
        )

def get_latest_valuation(self, ticker: str) -> dict | None:
    with self._conn() as conn:
        row = conn.execute(
            "SELECT data FROM valuations WHERE UPPER(ticker) = UPPER(?) ORDER BY rowid DESC LIMIT 1",
            (ticker,),
        ).fetchone()
    if not row:
        return None
    import json as _json
    result = _json.loads(row[0])
    result["ticker"] = ticker.upper()
    return result

def get_tracked_tickers(self) -> list[str]:
    with self._conn() as conn:
        rows = conn.execute(
            "SELECT DISTINCT UPPER(ticker) FROM analysis_runs WHERE ticker IS NOT NULL "
            "ORDER BY ticker"
        ).fetchall()
    return [r[0] for r in rows]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd iris && python -m pytest tests/test_retrieval_persistence.py -v`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add iris/tools/retrieval.py iris/tests/test_retrieval_persistence.py
git commit -m "feat: add analysis_runs table + valuation_record methods"
```

---

### Task 2: Session Accumulator — server-side data collection

**Files:**
- Modify: `iris/backend/sessions.py`
- Modify: `iris/backend/api.py` (on_event callback only)
- Test: `iris/tests/test_session_accumulator.py` (create)

This task adds the `accumulate_raw()` method to `AnalysisSession` and wires it into the `on_event` callback. The accumulator reads raw `HarnessEvent` data (not SSE-truncated).

- [ ] **Step 1: Write failing tests for session accumulator**

Create `iris/tests/test_session_accumulator.py`:

```python
"""Tests for AnalysisSession accumulator."""
import pytest
from unittest.mock import MagicMock
from core.harness import HarnessEvent, EventType
from backend.sessions import AnalysisSession, create_session


@pytest.fixture
def session():
    mock_harness = MagicMock()
    return create_session(mock_harness)


class TestAccumulateRaw:
    def test_accumulates_tool_start(self, session):
        event = HarnessEvent(type=EventType.TOOL_START, data={
            "tool": "yf_quote", "args": {"ticker": "NVDA"},
        })
        session.accumulate_raw(event)
        assert len(session.accumulated_timeline) == 1
        assert session.accumulated_timeline[0]["tool"] == "yf_quote"
        assert session.accumulated_timeline[0]["status"] == "running"

    def test_accumulates_tool_end(self, session):
        # First start the tool
        session.accumulate_raw(HarnessEvent(type=EventType.TOOL_START, data={
            "tool": "yf_quote", "args": {"ticker": "NVDA"},
        }))
        # Then end it with full (untruncated) result
        big_result = {"ticker": "NVDA", "price": 180.0, "data": "x" * 50000}
        session.accumulate_raw(HarnessEvent(type=EventType.TOOL_END, data={
            "tool": "yf_quote", "status": "ok", "result": big_result,
        }))
        assert session.accumulated_timeline[0]["status"] == "complete"
        # Panel data should have the full result, not truncated
        assert len(str(session.accumulated_panels.get("tool_results", {}).get("yf_quote", ""))) > 10000

    def test_accumulates_text_delta_reasoning(self, session):
        session.accumulate_raw(HarnessEvent(type=EventType.TEXT_DELTA, data={
            "content": "This is analysis text.",
        }))
        assert session.accumulated_reasoning == "This is analysis text."

    def test_accumulates_thinking_blocks(self, session):
        session.accumulate_raw(HarnessEvent(type=EventType.TEXT_DELTA, data={
            "content": "<thinking>I need to check WACC</thinking>",
        }))
        assert "I need to check WACC" in session.accumulated_thinking
        # Should also create a thinking timeline entry
        thinking_entries = [e for e in session.accumulated_timeline if e.get("tool") == "thinking"]
        assert len(thinking_entries) == 1

    def test_accumulates_build_dcf_result_for_valuation(self, session):
        session.accumulate_raw(HarnessEvent(type=EventType.TOOL_END, data={
            "tool": "build_dcf",
            "status": "ok",
            "result": {
                "fair_value_per_share": 119.35,
                "current_price": 181.85,
                "gap_pct": -34.1,
            },
        }))
        assert session.pending_valuation is not None
        assert session.pending_valuation["fair_value"] == 119.35

    def test_snapshot_returns_complete_data(self, session):
        session.accumulated_reasoning = "Final analysis"
        session.accumulated_thinking = "My thinking"
        session.accumulated_timeline.append({"tool": "test", "status": "complete"})
        snap = session.snapshot()
        assert snap["reasoning_text"] == "Final analysis"
        assert snap["thinking_text"] == "My thinking"
        assert len(snap["timeline"]) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd iris && python -m pytest tests/test_session_accumulator.py -v`
Expected: FAIL — `accumulate_raw`, `pending_valuation`, `snapshot` don't exist.

- [ ] **Step 3: Implement accumulator in sessions.py**

Add fields and methods to `AnalysisSession` in `iris/backend/sessions.py`:

```python
from core.harness import HarnessEvent, EventType
import time
import re

@dataclass
class AnalysisSession:
    # ... existing fields ...

    # Server-side accumulator
    accumulated_timeline: list = field(default_factory=list)
    accumulated_reasoning: str = ""
    accumulated_thinking: str = ""
    accumulated_panels: dict = field(default_factory=dict)  # raw tool_results
    accumulated_frontend_panels: dict = field(default_factory=lambda: {
        "data": {"metrics": [], "financialTables": [], "loading": False},
        "model": {"fairValue": None, "assumptions": [], "impliedMultiples": [],
                  "sensitivityData": [], "sensitivityRowLabel": "WACC",
                  "sensitivityColLabel": "Terminal Growth", "sensitivityRowValues": [],
                  "sensitivityColValues": [], "yearByYear": [], "loading": False},
        "comps": {"peers": [], "scatterData": [], "scatterXLabel": "EV/EBITDA",
                  "scatterYLabel": "Revenue Growth", "loading": False},
        "memory": {"calibrationHits": 0, "calibrationMisses": 0, "recentRecalls": [], "loading": False},
    })
    pending_valuation: dict | None = None
    _in_thinking: bool = False
    _current_thinking_buffer: str = ""  # tracks current thinking block for fullText

    def accumulate_raw(self, event: HarnessEvent) -> None:
        """Process raw HarnessEvent for server-side snapshot (untruncated)."""
        if event.type == EventType.TOOL_START:
            tool = event.data.get("tool", "")
            args = event.data.get("args", {})
            self.accumulated_timeline.append({
                "id": f"tool-{tool}-{int(time.time() * 1000)}",
                "timestamp": int(time.time() * 1000),
                "tool": tool,
                "message": f"{tool}({', '.join(f'{k}={v}' for k, v in (args or {}).items())})"[:100],
                "phase": "gather",
                "color": "green",
                "status": "running",
            })

        elif event.type == EventType.TOOL_END:
            tool = event.data.get("tool", "")
            status = event.data.get("status", "ok")
            result = event.data.get("result")
            # Update timeline entry
            for entry in reversed(self.accumulated_timeline):
                if entry.get("tool") == tool and entry.get("status") == "running":
                    entry["status"] = "error" if status == "error" else "complete"
                    break
            # Store full (untruncated) tool result
            if result and isinstance(result, dict):
                tool_results = self.accumulated_panels.setdefault("tool_results", {})
                tool_results[tool] = result
            # Extract valuation from build_dcf + build frontend panel
            if tool == "build_dcf" and status == "ok" and result:
                self.pending_valuation = {
                    "fair_value": result.get("fair_value_per_share"),
                    "current_price": result.get("current_price"),
                    "gap_pct": result.get("gap_pct"),
                }
                # Build frontend-shaped model panel from DCF result
                self._extract_model_panel(result)
            elif tool == "get_comps" and status == "ok" and result:
                self._extract_comps_panel(result)
            elif tool == "fmp_get_financials" and status == "ok" and result:
                self._extract_data_panel(result)
            elif tool == "yf_quote" and status == "ok" and result:
                self._extract_quote_metrics(result)

    def _extract_model_panel(self, result: dict):
        """Mirror frontend _extractPanelData for build_dcf."""
        mp = self.accumulated_frontend_panels["model"]
        fv = result.get("fair_value_per_share")
        cp = result.get("current_price")
        gap = result.get("gap_pct")
        if fv is not None:
            mp["fairValue"] = {
                "fairValue": fv, "currentPrice": cp or 0,
                "currency": "USD", "upside": gap or 0, "confidence": "medium",
            }
        mult = result.get("implied_multiples", {})
        if mult:
            mp["impliedMultiples"] = [
                {"label": k, "value": v} for k, v in mult.items() if v is not None
            ]
        sens = result.get("sensitivity", {})
        if sens:
            wacc_vals = sens.get("wacc_values", [])
            growth_vals = sens.get("growth_values", [])
            matrix = sens.get("matrix", [])
            mp["sensitivityRowValues"] = [f"{v*100:.1f}%" for v in wacc_vals]
            mp["sensitivityColValues"] = [f"{v*100:.1f}%" for v in growth_vals]
            cells = []
            for i, row in enumerate(matrix):
                for j, val in enumerate(row or []):
                    if val is not None:
                        cells.append({
                            "row": mp["sensitivityRowValues"][i] if i < len(mp["sensitivityRowValues"]) else "",
                            "col": mp["sensitivityColValues"][j] if j < len(mp["sensitivityColValues"]) else "",
                            "value": val,
                            "isBase": i == len(wacc_vals) // 2 and j == len(growth_vals) // 2,
                        })
            mp["sensitivityData"] = cells
        yby = result.get("year_by_year", [])
        if yby:
            mp["yearByYear"] = [{"year": f"Y{r['year']}", "revenue": r.get("revenue", 0),
                "growth": 0, "ebitda": r.get("ebit", 0),
                "margin": (r.get("ebit", 0) / r["revenue"] * 100) if r.get("revenue") else 0,
                "fcf": r.get("fcf", 0)} for r in yby]

    def _extract_comps_panel(self, result: dict):
        """Mirror frontend _extractPanelData for get_comps."""
        cp = self.accumulated_frontend_panels["comps"]
        raw_peers = result.get("peers", [])
        cp["peers"] = [{"ticker": p.get("ticker", ""), "name": p.get("ticker", ""),
            "marketCap": 0, "peRatio": p.get("fwd_pe") or 0,
            "evEbitda": p.get("ev_ebitda") or 0,
            "revenueGrowth": p.get("revenue_growth") or 0,
            "margin": p.get("gross_margin") or 0} for p in raw_peers]
        cp["scatterData"] = [{"ticker": p.get("ticker", ""), "x": p.get("ev_ebitda") or 0,
            "y": (p.get("revenue_growth") or 0) * 100,
            "isTarget": p.get("is_target", False)}
            for p in raw_peers if p.get("ev_ebitda") is not None]

    def _extract_data_panel(self, result: dict):
        """Mirror frontend _extractPanelData for fmp_get_financials (simplified)."""
        dp = self.accumulated_frontend_panels["data"]
        st = result.get("statement_type", "")
        raw_data = result.get("data", [])
        if st == "profile" and raw_data:
            p = raw_data[0] if isinstance(raw_data, list) else raw_data
            if p.get("price"): dp["metrics"].append({"label": "股价", "value": p["price"], "unit": "USD"})
            if p.get("mktCap"): dp["metrics"].append({"label": "市值", "value": f"{p['mktCap']/1e9:.1f}B", "unit": "USD"})

    def _extract_quote_metrics(self, result: dict):
        """Mirror frontend _extractPanelData for yf_quote."""
        dp = self.accumulated_frontend_panels["data"]
        t = result.get("ticker", "")
        if result.get("price"): dp["metrics"].append({"label": f"{t} 价格", "value": result["price"], "unit": result.get("currency", "USD")})
        if result.get("market_cap"): dp["metrics"].append({"label": "市值", "value": f"${result['market_cap']/1e9:.1f}B"})

        elif event.type == EventType.TEXT_DELTA:
            content = event.data.get("content", "")
            if not content:
                return
            # Parse thinking blocks
            open_idx = content.find("<thinking>")
            close_idx = content.find("</thinking>")
            if open_idx != -1 and close_idx != -1 and close_idx > open_idx:
                before = content[:open_idx]
                inside = content[open_idx + 10:close_idx]
                after = content[close_idx + 12:]
                if before:
                    self.accumulated_reasoning += before
                if inside:
                    self.accumulated_thinking += inside + "\n"
                    self.accumulated_timeline.append({
                        "id": f"thinking-{int(time.time() * 1000)}",
                        "timestamp": int(time.time() * 1000),
                        "tool": "thinking",
                        "message": inside.split("\n")[0][:80],
                        "fullText": inside,
                        "phase": "gather",
                        "color": "gold",
                        "status": "complete",
                    })
                if after:
                    self.accumulated_reasoning += after
            elif open_idx != -1:
                before = content[:open_idx]
                after = content[open_idx + 10:]
                if before:
                    self.accumulated_reasoning += before
                self._current_thinking_buffer = ""  # reset buffer for new block
                if after:
                    self._current_thinking_buffer += after
                    self.accumulated_thinking += after
                self._in_thinking = True
            elif close_idx != -1:
                before = content[:close_idx]
                after = content[close_idx + 12:]
                if before:
                    self._current_thinking_buffer += before
                    self.accumulated_thinking += before
                self.accumulated_thinking += "\n"
                # Emit thinking timeline entry with FULL block text
                full_text = self._current_thinking_buffer.strip()
                preview = full_text.split("\n")[0][:80] if full_text else "..."
                self.accumulated_timeline.append({
                    "id": f"thinking-{int(time.time() * 1000)}",
                    "timestamp": int(time.time() * 1000),
                    "tool": "thinking",
                    "message": preview,
                    "fullText": full_text,
                    "phase": "gather",
                    "color": "gold",
                    "status": "complete",
                })
                self._current_thinking_buffer = ""
                if after:
                    self.accumulated_reasoning += after
                self._in_thinking = False
            else:
                if self._in_thinking:
                    self._current_thinking_buffer += content
                    self.accumulated_thinking += content
                else:
                    self.accumulated_reasoning += content

    def snapshot(self) -> dict:
        """Return complete snapshot for persistence.

        IMPORTANT: panels must be in frontend-compatible shape, not raw tool_results.
        The accumulator builds both: tool_results (raw) for future flexibility,
        and frontend-shaped panels (data/model/comps/memory) for direct loadSnapshot().
        """
        return {
            "reasoning_text": self.accumulated_reasoning,
            "thinking_text": self.accumulated_thinking,
            "timeline": self.accumulated_timeline,
            "panels": self.accumulated_frontend_panels,  # frontend-shaped, not raw
        }
```

- [ ] **Step 4: Wire accumulator into api.py on_event callback**

In `iris/backend/api.py`, modify the `on_event` function inside `start_analysis()` (around line 126):

```python
    def on_event(event: HarnessEvent) -> None:
        sse = harness_event_to_sse(event)
        if sse is not None:
            session.events.put(sse)
            session.touch()
        # Accumulator path: reads raw event with full data
        session.accumulate_raw(event)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd iris && python -m pytest tests/test_session_accumulator.py -v`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add iris/backend/sessions.py iris/backend/api.py iris/tests/test_session_accumulator.py
git commit -m "feat: add server-side session accumulator for persistence"
```

---

### Task 3: Persist analysis results on completion + history/watchlist APIs

**Files:**
- Modify: `iris/backend/api.py` (rewrite watchlist, add history endpoints, persist on completion)
- Modify: `iris/tools/memory.py` (delete regex, change calibration)
- Test: `iris/tests/test_api_history.py` (create)

This task wires the persistence into the analysis completion flow and adds the new API endpoints.

- [ ] **Step 1: Write failing test for history API**

Create `iris/tests/test_api_history.py`:

```python
"""Tests for history and watchlist API endpoints."""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from backend.api import app
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_retriever():
    """Provide a mock retriever for API tests."""
    with patch("backend.api._get_retriever") as mock:
        r = MagicMock()
        r.list_analysis_runs.return_value = {
            "items": [
                {"id": "run-1", "query": "分析 NVDA", "ticker": "NVDA",
                 "status": "complete", "created_at": "2026-03-19T10:00:00",
                 "recommendation": None, "tokens_in": 5000, "tokens_out": 2000}
            ],
            "total": 1, "limit": 30, "offset": 0,
        }
        r.get_analysis_run.return_value = {
            "id": "run-1", "query": "分析 NVDA", "ticker": "NVDA",
            "status": "complete", "created_at": "2026-03-19T10:00:00",
            "reasoning_text": "Analysis text", "thinking_text": "Thinking text",
            "timeline_json": "[]", "panels_json": "{}",
            "tokens_in": 5000, "tokens_out": 2000,
        }
        r.get_tracked_tickers.return_value = ["NVDA", "AAPL"]
        r.get_latest_valuation.return_value = {"fair_value": 119.35, "ticker": "NVDA"}
        r.list_hypotheses.return_value = []
        r.get_latest_run_for_ticker.return_value = {"id": "run-1"}
        mock.return_value = r
        yield r


def test_get_history_list(client, mock_retriever):
    resp = client.get("/api/history")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["ticker"] == "NVDA"


def test_get_history_detail(client, mock_retriever):
    resp = client.get("/api/history/run-1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["reasoning_text"] == "Analysis text"


def test_get_history_detail_404(client, mock_retriever):
    mock_retriever.get_analysis_run.return_value = None
    resp = client.get("/api/history/nonexistent")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd iris && python -m pytest tests/test_api_history.py -v`
Expected: FAIL — endpoints don't exist.

- [ ] **Step 3: Add a `_get_retriever()` helper to api.py**

Add near top of `iris/backend/api.py` (after imports):

```python
from tools.retrieval import SQLiteRetriever
from core.config import DB_PATH

def _get_retriever() -> SQLiteRetriever:
    return SQLiteRetriever(DB_PATH)
```

- [ ] **Step 4: Add history + session status endpoints to api.py**

Add these endpoints to `iris/backend/api.py`:

```python
@app.get("/api/analyze/{analysis_id}/status")
async def session_status(analysis_id: str):
    """Lightweight probe: does this session exist? Used by frontend before SSE."""
    session = get_session(analysis_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"exists": True, "status": session.status}


@app.get("/api/history")
async def list_history(
    ticker: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    retriever = _get_retriever()
    return retriever.list_analysis_runs(ticker=ticker, limit=limit, offset=offset)


@app.get("/api/history/{run_id}")
async def get_history_detail(run_id: str):
    retriever = _get_retriever()
    run = retriever.get_analysis_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    # Parse JSON fields for the response
    import json as _json
    run["timeline"] = _json.loads(run.get("timeline_json") or "[]")
    run["panels"] = _json.loads(run.get("panels_json") or "{}")
    del run["timeline_json"]
    del run["panels_json"]
    return run
```

- [ ] **Step 5: Persist analysis on completion in api.py _run()**

Modify the `_run()` function inside `start_analysis()` (around line 142). After `result = harness.run(...)` and before pushing the SSE completion event:

```python
    def _run():
        try:
            result = harness.run(req.query, context_docs=req.contextDocs)

            # --- NEW: Persist to DB ---
            snap = session.snapshot()
            retriever = _get_retriever()

            # Extract ticker from query or tool results (best-effort)
            ticker = _extract_ticker(req.query, snap)

            # Save valuation record if build_dcf was called
            if session.pending_valuation and ticker:
                pv = session.pending_valuation
                retriever.save_valuation_record(
                    ticker=ticker,
                    fair_value=pv["fair_value"],
                    current_price=pv["current_price"],
                    gap_pct=pv["gap_pct"],
                    run_id=session.id,
                )

            # Save the full analysis run
            retriever.save_analysis_run(
                id=session.id,
                query=req.query,
                ticker=ticker,
                status="complete" if result.ok else "error",
                reasoning_text=snap["reasoning_text"],
                thinking_text=snap["thinking_text"],
                timeline_json=json.dumps(snap["timeline"], ensure_ascii=False, default=str),
                panels_json=json.dumps(snap["panels"], ensure_ascii=False, default=str),
                tokens_in=result.total_input_tokens,
                tokens_out=result.total_output_tokens,
            )
            # --- END NEW ---

            session.events.put({...})  # existing completion event
```

Add the ticker extraction helper:

```python
def _extract_ticker(query: str, snapshot: dict) -> str | None:
    """Best-effort ticker extraction from query and tool results."""
    # Check if any tool result had a ticker field
    tool_results = snapshot.get("panels", {}).get("tool_results", {})
    for tool_name in ["yf_quote", "build_dcf", "fmp_get_financials"]:
        result = tool_results.get(tool_name, {})
        if isinstance(result, dict) and result.get("ticker"):
            return result["ticker"].upper()
    # Fallback: look for uppercase 1-5 letter words in query
    import re
    match = re.search(r'\b([A-Z]{1,5})\b', query)
    return match.group(1) if match else None
```

- [ ] **Step 6: Rewrite watchlist endpoint**

Replace the entire `get_watchlist()` function and delete all regex helper functions (`_parse_company_file`, `_extract_number`, `_extract_section`, `_compute_alerts`, `_extract_kill_section`, `_check_calibration_warning`):

```python
@app.get("/api/watchlist")
async def get_watchlist():
    """Build watchlist from DB (structured data) + live yf_quote prices."""
    import asyncio
    import functools
    from tools.market import yf_quote

    retriever = _get_retriever()
    tickers = retriever.get_tracked_tickers()
    if not tickers:
        return []

    loop = asyncio.get_event_loop()

    # Parallel yf_quote for all tickers
    async def fetch_quote(t: str) -> dict:
        try:
            result = await loop.run_in_executor(None, functools.partial(yf_quote, t))
            if result.status == "ok":
                return result.data
        except Exception:
            pass
        return {}

    quotes = await asyncio.gather(*[fetch_quote(t) for t in tickers])
    quote_map = {t: q for t, q in zip(tickers, quotes)}

    watchlist = []
    for ticker in tickers:
        quote = quote_map.get(ticker, {})
        val = retriever.get_latest_valuation(ticker)
        latest_run = retriever.get_latest_run_for_ticker(ticker)

        # Get thesis from hypotheses table
        hyps = retriever.list_hypotheses(company=ticker)
        thesis = hyps[-1].thesis if hyps else None

        fair_value = val["fair_value"] if val else None
        market_price = quote.get("price")
        gap = None
        if fair_value is not None and market_price is not None and market_price != 0:
            gap = round((fair_value - market_price) / market_price, 4)

        watchlist.append({
            "ticker": ticker,
            "name": quote.get("name"),
            "market_price": market_price,
            "fair_value": fair_value,
            "gap": gap,
            "thesis": thesis,
            "recommendation": latest_run.get("recommendation") if latest_run else None,
            "latest_run_id": latest_run["id"] if latest_run else None,
            "alerts": [],
        })

    return watchlist
```

- [ ] **Step 7: Delete regex functions from memory.py**

In `iris/tools/memory.py`:
- Delete `_extract_fair_value()` function (lines 188-202)
- Modify `_append_calibration_entry()` to read from DB instead of regex:

```python
def _append_calibration_entry(company: str, content: str):
    """Append calibration entry using DB valuation, not regex."""
    from tools.retrieval import SQLiteRetriever
    from core.config import DB_PATH
    retriever = SQLiteRetriever(DB_PATH)
    val = retriever.get_latest_valuation(company)
    if val is None:
        return  # No valuation exists, nothing to calibrate

    predicted = val["fair_value"]
    entry = {
        "date": date.today().isoformat(),
        "company": company,
        "metric": "fair_value",
        "predicted": predicted,
        "actual": None,
        "analyst_consensus": None,
        "note": "pending 90-day review",
    }
    log_path = _memory_base() / "calibration" / "prediction_log.jsonl"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
```

- [ ] **Step 8: Run all tests**

Run: `cd iris && python -m pytest tests/ -v`
Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
git add iris/backend/api.py iris/tools/memory.py iris/tests/test_api_history.py
git commit -m "feat: add history APIs, persist analysis runs, replace regex with DB reads"
```

---

### Task 4: Frontend types + API client

**Files:**
- Modify: `iris-frontend/src/types/analysis.ts`
- Modify: `iris-frontend/src/types/api.ts`
- Modify: `iris-frontend/src/utils/api.ts`

This task adds TypeScript types and API functions the UI tasks depend on.

- [ ] **Step 1: Add new types to analysis.ts**

Append to `iris-frontend/src/types/analysis.ts`:

```typescript
export type EventColor = "green" | "blue" | "amber" | "gray" | "purple" | "gold";

// NOTE: Also update the existing TimelineEvent interface to add optional fullText:
// export interface TimelineEvent {
//   ...existing fields...
//   fullText?: string;  // ADD THIS — used by thinking entries for expanded content
// }

export interface ThinkingTimelineEvent extends TimelineEvent {
  tool: "thinking";
  fullText: string;
  collapsed?: boolean;
}

export interface AnalysisSnapshot {
  id: string;
  query: string;
  ticker: string | null;
  status: string;
  created_at: string;
  reasoning_text: string;
  thinking_text: string;
  timeline: TimelineEvent[];
  panels: {
    data: DataPanelState;
    model: ModelPanelState;
    comps: CompsPanelState;
    memory: MemoryPanelState;
  };
  tokens_in: number;
  tokens_out: number;
}

export interface HistoryItem {
  id: string;
  query: string;
  ticker: string | null;
  status: string;
  created_at: string;
  recommendation: string | null;
  tokens_in: number;
  tokens_out: number;
}

export interface HistoryListResponse {
  items: HistoryItem[];
  total: number;
  limit: number;
  offset: number;
}
```

Update `WatchlistItem` to include new fields:

```typescript
export interface WatchlistItem {
  ticker: string;
  name: string | null;
  fair_value: number | null;
  market_price: number | null;
  gap: number | null;
  thesis: string | null;
  recommendation: string | null;
  latest_run_id: string | null;
  alerts: WatchlistAlert[];
}
```

Also update the `EventColor` type (line 7) to include `"gold"`.

- [ ] **Step 2: Add API functions to api.ts**

Append to `iris-frontend/src/utils/api.ts`:

```typescript
import type { HistoryListResponse, AnalysisSnapshot } from "@/types/analysis";

export async function getHistory(
  ticker?: string,
  limit = 30,
  offset = 0
): Promise<HistoryListResponse> {
  const params = new URLSearchParams();
  if (ticker) params.set("ticker", ticker);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return request<HistoryListResponse>(`/api/history?${params}`);
}

export async function getHistoryDetail(
  runId: string
): Promise<AnalysisSnapshot> {
  return request<AnalysisSnapshot>(`/api/history/${encodeURIComponent(runId)}`);
}

export async function probeSession(
  analysisId: string
): Promise<boolean> {
  // Uses dedicated lightweight status endpoint, NOT HEAD on SSE stream
  // (HEAD on SSE would trigger full handler, potentially consuming queue events)
  try {
    const res = await fetch(`${BASE_URL}/api/analyze/${analysisId}/status`);
    return res.status === 200;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add iris-frontend/src/types/analysis.ts iris-frontend/src/types/api.ts iris-frontend/src/utils/api.ts
git commit -m "feat: add frontend types and API client for history/snapshot"
```

---

### Task 5: Homepage redesign — watchlist + history sections + refresh

**Files:**
- Modify: `iris-frontend/src/app/page.tsx`
- Modify: `iris-frontend/src/components/WatchlistGrid.tsx`
- Modify: `iris-frontend/src/components/WatchlistCard.tsx`

- [ ] **Step 1: Rewrite page.tsx with two sections + refresh button**

Replace `iris-frontend/src/app/page.tsx` entirely:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchBar } from "@/components/SearchBar";
import { WatchlistGrid } from "@/components/WatchlistGrid";
import type { WatchlistItem, HistoryItem, HistoryListResponse } from "@/types/analysis";
import { getWatchlist, getHistory } from "@/utils/api";

export default function HomePage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadingWatchlist(true);
    setLoadingHistory(true);
    setError(null);
    try {
      const [wl, hist] = await Promise.all([
        getWatchlist(),
        getHistory(),
      ]);
      setWatchlist(wl);
      setHistory(hist.items);
    } catch {
      setError("数据加载失败");
    } finally {
      setLoadingWatchlist(false);
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const refreshWatchlist = useCallback(async () => {
    setLoadingWatchlist(true);
    try {
      const wl = await getWatchlist();
      setWatchlist(wl);
    } catch {
      setError("刷新失败");
    } finally {
      setLoadingWatchlist(false);
    }
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--iris-bg)" }}>
      <div className="mx-auto max-w-5xl px-4 pt-3 pb-2">
        <SearchBar />
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-8">
        {error && (
          <div className="mt-2 border px-3 py-2 text-[12px]"
            style={{ borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.05)", color: "#f87171", borderRadius: "2px" }}>
            {error}
          </div>
        )}

        {/* Watchlist Section */}
        <WatchlistGrid items={watchlist} loading={loadingWatchlist} onRefresh={refreshWatchlist} />

        {/* History Section */}
        {!loadingHistory && history.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-3 border-b px-2 py-1.5"
              style={{ borderColor: "var(--iris-accent)", borderBottomWidth: "1px" }}>
              <h2 className="text-[13px] font-semibold tracking-wide uppercase"
                style={{ color: "var(--iris-text-secondary)" }}>分析历史</h2>
              <span className="font-data text-[11px]" style={{ color: "var(--iris-accent)" }}>
                {history.length}
              </span>
            </div>
            <table className="mt-1 w-full">
              <thead>
                <tr>
                  <th className="text-left text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>日期</th>
                  <th className="text-left text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>查询</th>
                  <th className="text-left text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>Ticker</th>
                  <th className="text-right text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>状态</th>
                  <th className="text-right text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="cursor-pointer hover:bg-[var(--iris-surface)]"
                    onClick={() => { window.location.href = `/analysis/${item.id}`; }}>
                    <td className="px-2 py-1 text-[11px]" style={{ color: "var(--iris-text-muted)" }}>
                      {item.created_at?.substring(0, 10)}
                    </td>
                    <td className="px-2 py-1 text-[12px] max-w-[300px] truncate" style={{ color: "var(--iris-text)" }}>
                      {item.query}
                    </td>
                    <td className="px-2 py-1 text-[12px] font-bold" style={{ color: "var(--iris-text)" }}>
                      {item.ticker || "—"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <span className="px-1.5 py-0.5 text-[10px] rounded-[2px]"
                        style={{
                          background: item.status === "complete" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                          color: item.status === "complete" ? "#22C55E" : "#EF4444",
                        }}>
                        {item.status === "complete" ? "完成" : "错误"}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right text-[10px] font-mono" style={{ color: "var(--iris-text-muted)" }}>
                      {((item.tokens_in + item.tokens_out) / 1000).toFixed(1)}k
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loadingWatchlist && !loadingHistory && watchlist.length === 0 && history.length === 0 && (
          <div className="mt-2 border border-dashed px-4 py-6 text-[12px]"
            style={{ borderColor: "var(--iris-border)", color: "var(--iris-text-muted)", borderRadius: "2px" }}>
            尚未追踪任何标的。在上方搜索栏输入 ticker 或公司名称，启动你的第一次深度分析。
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update WatchlistGrid to accept loading/onRefresh props**

Rewrite `iris-frontend/src/components/WatchlistGrid.tsx`:

```tsx
"use client";

import type { WatchlistItem } from "@/types/analysis";
import { WatchlistRow } from "./WatchlistCard";

interface WatchlistGridProps {
  items: WatchlistItem[];
  loading: boolean;
  onRefresh: () => void;
}

export function WatchlistGrid({ items, loading, onRefresh }: WatchlistGridProps) {
  return (
    <div>
      <div className="flex items-center gap-3 border-b px-2 py-1.5"
        style={{ borderColor: "var(--iris-accent)", borderBottomWidth: "1px" }}>
        <h2 className="text-[13px] font-semibold tracking-wide uppercase"
          style={{ color: "var(--iris-text-secondary)" }}>监控列表</h2>
        <span className="font-data text-[11px]" style={{ color: "var(--iris-accent)" }}>
          {items.length}
        </span>
        <button onClick={onRefresh} disabled={loading}
          className="ml-auto text-[11px] px-2 py-0.5 rounded-[2px] disabled:opacity-30"
          style={{ color: "var(--iris-text-muted)", border: "1px solid var(--iris-border)" }}>
          {loading ? "刷新中..." : "↻ 刷新"}
        </button>
      </div>
      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 py-4 px-2 text-[11px]" style={{ color: "var(--iris-text-muted)" }}>
          <div className="h-3 w-3 animate-spin rounded-full border border-t-transparent"
            style={{ borderColor: "var(--iris-accent)", borderTopColor: "transparent" }} />
          加载中...
        </div>
      ) : items.length > 0 ? (
        <table className="mt-1 w-full">
          <thead>
            <tr>
              <th className="text-left text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>Ticker</th>
              <th className="text-left text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>Name</th>
              <th className="text-right text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>Price</th>
              <th className="text-right text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>Gap%</th>
              <th className="text-right text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>Fair Value</th>
              <th className="text-right text-[11px] px-2 py-1" style={{ color: "var(--iris-text-muted)" }}>Rec</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <WatchlistRow key={item.ticker} item={item} />
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Update WatchlistCard with correct click behavior + new fields**

Rewrite `iris-frontend/src/components/WatchlistCard.tsx`:

```tsx
"use client";

import type { WatchlistItem } from "@/types/analysis";
import { formatCurrency } from "@/utils/formatters";

interface WatchlistRowProps {
  item: WatchlistItem;
}

export function WatchlistRow({ item }: WatchlistRowProps) {
  const gapPct = item.gap != null ? item.gap * 100 : null;
  const isPositiveGap = gapPct != null && gapPct > 0;
  const isNegativeGap = gapPct != null && gapPct < 0;

  const handleClick = () => {
    if (item.latest_run_id) {
      window.location.href = `/analysis/${item.latest_run_id}`;
    } else {
      // No analysis exists — could show prompt, for now do nothing
    }
  };

  return (
    <tr className="cursor-pointer hover:bg-[var(--iris-surface)]" onClick={handleClick}>
      <td className="px-2 py-1 text-[12px] font-bold" style={{ color: "var(--iris-text)" }}>
        {item.ticker}
      </td>
      <td className="px-2 py-1 max-w-[160px] truncate text-[11px]" style={{ color: "var(--iris-text-muted)" }}>
        {item.name ?? "—"}
      </td>
      <td className="px-2 py-1 font-data text-right text-[12px]" style={{ color: "var(--iris-data)" }}>
        {item.market_price != null ? formatCurrency(item.market_price) : "—"}
      </td>
      <td className="px-2 py-1 font-data text-right text-[12px] font-medium"
        style={{ color: isPositiveGap ? "#22C55E" : isNegativeGap ? "#EF4444" : "var(--iris-text-secondary)" }}>
        {gapPct != null ? `${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(1)}%` : "—"}
      </td>
      <td className="px-2 py-1 font-data text-right text-[12px]" style={{ color: "var(--iris-data)" }}>
        {item.fair_value != null ? formatCurrency(item.fair_value) : "—"}
      </td>
      <td className="px-2 py-1 text-right text-[11px]" style={{ color: "var(--iris-text-muted)" }}>
        {item.recommendation ?? "—"}
      </td>
    </tr>
  );
}
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd iris-frontend && npx next build 2>&1 | tail -20`
Expected: Build succeeds or only has type warnings (not errors).

- [ ] **Step 5: Commit**

```bash
git add iris-frontend/src/app/page.tsx iris-frontend/src/components/WatchlistGrid.tsx iris-frontend/src/components/WatchlistCard.tsx
git commit -m "feat: homepage with live watchlist + history section + refresh button"
```

---

### Task 6: Analysis page dual mode (live + replay)

**Files:**
- Modify: `iris-frontend/src/app/analysis/[id]/page.tsx`
- Modify: `iris-frontend/src/hooks/useAnalysisStream.ts`
- Modify: `iris-frontend/src/hooks/useAnalysisStore.ts`

- [ ] **Step 1: Add loadSnapshot action to useAnalysisStore.ts**

Add to the store interface and implementation in `iris-frontend/src/hooks/useAnalysisStore.ts`:

In the interface, add:
```typescript
  loadSnapshot: (snapshot: AnalysisSnapshot) => void;
  isReplay: boolean;
```

In the store creation, add `isReplay: false` to initial state and add the action:

```typescript
  loadSnapshot: (snapshot) => {
    set({
      pageState: "COMPLETE",
      isReplay: true,
      analysisId: snapshot.id,
      reasoningText: snapshot.reasoning_text || "",
      thinkingText: snapshot.thinking_text || "",
      timeline: snapshot.timeline || [],
      dataPanel: snapshot.panels?.data || initialDataPanel,
      modelPanel: snapshot.panels?.model || initialModelPanel,
      compsPanel: snapshot.panels?.comps || initialCompsPanel,
      memoryPanel: snapshot.panels?.memory || initialMemoryPanel,
    });
  },
```

Also add `isReplay: false` to the `reset()` method.

- [ ] **Step 2: Rewrite useAnalysisStream.ts with fetch-first probe**

Replace the `useAnalysisStream` hook in `iris-frontend/src/hooks/useAnalysisStream.ts`:

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAnalysisStore } from "./useAnalysisStore";
import { probeSession, getHistoryDetail } from "@/utils/api";
import type { SSEEvent, SSEEventType } from "@/types/api";

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

const SSE_EVENT_TYPES: SSEEventType[] = [
  "tool_start", "tool_end", "text_delta", "text",
  "context_compacted", "retry", "error", "system",
  "steering", "user_input_needed", "analysis_complete", "done",
];

export function useAnalysisStream(analysisId: string | null) {
  const handleSSEEvent = useAnalysisStore((s) => s.handleSSEEvent);
  const loadSnapshot = useAnalysisStore((s) => s.loadSnapshot);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const resolvedRef = useRef(false);

  const connectSSE = useCallback((id: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const es = new EventSource(`${baseUrl}/api/analyze/${id}/stream`);
    eventSourceRef.current = es;

    for (const eventType of SSE_EVENT_TYPES) {
      es.addEventListener(eventType, (evt: MessageEvent) => {
        try {
          if (evt.data === undefined || evt.data === null) return;
          const data = JSON.parse(evt.data);
          const sseEvent: SSEEvent = { type: eventType, data, timestamp: Date.now() };
          handleSSEEvent(sseEvent);
          retriesRef.current = 0;
          if (eventType === "done") {
            es.close();
            eventSourceRef.current = null;
          }
        } catch (err) {
          console.error(`Failed to parse SSE event [${eventType}]:`, err);
        }
      });
    }

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      if (retriesRef.current < MAX_RETRIES) {
        const delay = BASE_BACKOFF_MS * Math.pow(2, retriesRef.current);
        retriesRef.current += 1;
        setTimeout(() => connectSSE(id), delay);
      }
    };
  }, [handleSSEEvent]);

  useEffect(() => {
    if (!analysisId || resolvedRef.current) return;
    resolvedRef.current = true;

    // Fetch-first probe: determine live vs replay mode
    (async () => {
      const isLive = await probeSession(analysisId);
      if (isLive) {
        connectSSE(analysisId);
      } else {
        // Try loading from history
        try {
          const snapshot = await getHistoryDetail(analysisId);
          loadSnapshot(snapshot);
        } catch {
          console.error("Analysis not found in live sessions or history");
          useAnalysisStore.setState({ pageState: "COMPLETE" });
        }
      }
    })();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      retriesRef.current = 0;
      resolvedRef.current = false;
    };
  }, [analysisId, connectSSE, loadSnapshot]);
}
```

- [ ] **Step 3: Update analysis page.tsx for replay mode**

Modify `iris-frontend/src/app/analysis/[id]/page.tsx` — add replay banner and hide steering in replay:

Add after the imports:
```typescript
const isReplay = useAnalysisStore((s) => s.isReplay);
```

Add replay banner after the opening `<div>`:
```tsx
{isReplay && (
  <div className="flex-shrink-0 px-3 py-1 text-[11px] border-b"
    style={{ borderColor: "var(--iris-accent)", color: "var(--iris-accent)", background: "rgba(201,168,76,0.05)" }}>
    历史回看 — {/* date and query from store */}
  </div>
)}
```

Change the bottom section to hide SteeringInput in replay:
```tsx
{pageState === "WAITING" && pendingQuestion ? (
  <PendingQuestionCard />
) : !isReplay ? (
  <SteeringInput />
) : null}
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd iris-frontend && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add iris-frontend/src/app/analysis/[id]/page.tsx iris-frontend/src/hooks/useAnalysisStream.ts iris-frontend/src/hooks/useAnalysisStore.ts
git commit -m "feat: analysis page dual mode — live SSE or replay from DB snapshot"
```

---

### Task 7: Thinking entries in Timeline

**Files:**
- Modify: `iris-frontend/src/components/TimelineItem.tsx`
- Modify: `iris-frontend/src/hooks/useAnalysisStore.ts` (handleSSEEvent for thinking)

- [ ] **Step 1: Add thinking entry rendering to TimelineItem.tsx**

Add a thinking-specific branch at the top of the component. When `event.tool === "thinking"`, render differently:

```tsx
// Add to TimelineItem.tsx — inside the component function, before the default return:

if (event.tool === "thinking") {
  const [expanded, setExpanded] = useState(false);
  const fullText = (event as any).fullText || event.message;
  return (
    <div className="relative px-1" style={{ paddingTop: 2, paddingBottom: 2 }}>
      <div
        className="cursor-pointer rounded-[2px] px-2 py-1"
        style={{
          borderLeft: "2px solid var(--iris-accent)",
          background: expanded ? "rgba(201,168,76,0.05)" : "transparent",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: 9, color: "var(--iris-accent)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 150ms", display: "inline-block" }}>▶</span>
          <span style={{ fontSize: 10, color: "var(--iris-accent)", fontWeight: 600 }}>AI 思考</span>
          {!expanded && (
            <span className="truncate" style={{ fontSize: 10, color: "var(--iris-text-muted)" }}>
              — {event.message}
            </span>
          )}
        </div>
        {expanded && (
          <pre className="mt-1 whitespace-pre-wrap font-mono" style={{ fontSize: 10, lineHeight: 1.5, color: "var(--iris-text-secondary)" }}>
            {fullText}
          </pre>
        )}
      </div>
    </div>
  );
}
```

Add `import { useState } from "react"` at top. Add `"use client"` directive if not present.

- [ ] **Step 2: Add thinking block parsing to handleSSEEvent in useAnalysisStore.ts**

In the `text_delta` case of `handleSSEEvent`, after detecting a `</thinking>` close tag, emit a thinking timeline entry:

Find the `</thinking>` handling in the text_delta case (around line 253) and add after `inThinking = false;`:

```typescript
// Emit thinking timeline entry
const thinkingPreview = before.split("\n")[0].trim().slice(0, 80);
const thinkingEntry: TimelineEvent = {
  id: `thinking-${Date.now()}`,
  timestamp: Date.now(),
  tool: "thinking",
  message: thinkingPreview || "...",
  fullText: before,
  phase: s.currentPhase,
  color: "gold" as EventColor,
  status: "complete",
};
// Return includes new entry
```

Integrate this into the existing state update for the close tag case.

- [ ] **Step 3: Verify frontend compiles**

Run: `cd iris-frontend && npx next build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add iris-frontend/src/components/TimelineItem.tsx iris-frontend/src/hooks/useAnalysisStore.ts
git commit -m "feat: thinking blocks rendered as collapsible gold timeline entries"
```

---

### Task 8: E2E smoke test

**Files:**
- No new files — manual verification

- [ ] **Step 1: Start backend and frontend**

```bash
cd iris && python -m uvicorn backend.api:app --host 0.0.0.0 --port 8000 --reload &
cd iris-frontend && npm run dev &
```

- [ ] **Step 2: Verify homepage loads empty state**

Open http://localhost:3000. Should see empty watchlist with guide text. No errors in console.

- [ ] **Step 3: Run an analysis**

Type "分析 NVDA" in search bar, click 分析. Verify:
- Analysis page opens with SSE streaming
- Timeline shows tool calls
- Thinking blocks appear as gold collapsible entries
- Panels populate (data, model, comps)
- Analysis completes

- [ ] **Step 4: Verify persistence**

After analysis completes:
- Go back to homepage
- Watchlist should show NVDA with live price, fair value, name
- History section should show the analysis run
- Click refresh button — prices should update

- [ ] **Step 5: Verify replay**

Click the history entry. Verify:
- Analysis page loads in replay mode
- "历史回看" banner visible
- Timeline, reasoning, panels all populated from snapshot
- SteeringInput hidden
- All panels show correct data

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: E2E verified — persistence + history + replay + live watchlist"
```
