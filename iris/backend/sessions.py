"""
Session management for IRIS backend.

Each analysis run gets an AnalysisSession that bridges the harness thread
with the async FastAPI layer via a threading.Queue.

The session also accumulates raw (untruncated) harness event data for
persistence via accumulate_raw().
"""

from __future__ import annotations

import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

from core.harness import EventType, Harness, HarnessEvent


def _default_frontend_panels() -> dict:
    """Return the initial frontend-shaped panel structure."""
    return {
        "data": {"metrics": [], "financialTables": [], "loading": False},
        "model": {
            "fairValue": None,
            "assumptions": [],
            "impliedMultiples": [],
            "sensitivityData": [],
            "sensitivityRowLabel": "WACC",
            "sensitivityColLabel": "Terminal Growth",
            "sensitivityRowValues": [],
            "sensitivityColValues": [],
            "yearByYear": [],
            "loading": False,
        },
        "comps": {
            "peers": [],
            "scatterData": [],
            "scatterXLabel": "EV/EBITDA",
            "scatterYLabel": "Revenue Growth",
            "loading": False,
        },
        "memory": {
            "calibrationHits": 0,
            "calibrationMisses": 0,
            "recentRecalls": [],
            "loading": False,
        },
    }


@dataclass
class AnalysisSession:
    id: str
    harness: Harness
    events: queue.Queue  # Queue[dict] — threading.Queue, NOT asyncio.Queue
    status: Literal["running", "waiting", "complete", "error"] = "running"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    user_input_event: threading.Event = field(default_factory=threading.Event)
    user_input_response: str | None = None
    last_activity: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # ── Accumulator state ─────────────────────────────────────
    accumulated_timeline: list = field(default_factory=list)
    accumulated_reasoning: str = ""
    accumulated_thinking: str = ""
    accumulated_panels: dict = field(default_factory=dict)
    accumulated_frontend_panels: dict = field(default_factory=_default_frontend_panels)
    pending_valuation: dict | None = None
    _in_thinking: bool = False
    _current_thinking_buffer: str = ""

    def touch(self) -> None:
        """Update last_activity timestamp."""
        self.last_activity = datetime.now(timezone.utc)

    # ── Accumulator ───────────────────────────────────────────

    def accumulate_raw(self, event: HarnessEvent) -> None:
        """
        Accumulate raw HarnessEvent data (untruncated).

        Handles TOOL_START, TOOL_END, and TEXT_DELTA events to build up
        timeline, reasoning/thinking text, and panel data.
        """
        if event.type == EventType.TOOL_START:
            self._handle_tool_start(event)
        elif event.type == EventType.TOOL_END:
            self._handle_tool_end(event)
        elif event.type == EventType.TEXT_DELTA:
            self._handle_text_delta(event)

    def _handle_tool_start(self, event: HarnessEvent) -> None:
        tool = event.data.get("tool", "")
        self.accumulated_timeline.append({
            "tool": tool,
            "args": event.data.get("args"),
            "status": "running",
            "timestamp": time.time(),
        })

    def _handle_tool_end(self, event: HarnessEvent) -> None:
        tool = event.data.get("tool", "")
        status = event.data.get("status", "ok")
        result = event.data.get("result")

        # Mark the last running timeline entry for this tool as complete
        for entry in reversed(self.accumulated_timeline):
            if entry["tool"] == tool and entry["status"] == "running":
                entry["status"] = "error" if status == "error" else "complete"
                break

        # Store full untruncated result
        if result is not None:
            self.accumulated_panels[tool] = result

        # Extract frontend-shaped panel data
        if result and isinstance(result, dict):
            if tool == "build_dcf":
                self.pending_valuation = result
                self._extract_model_panel(result)
            elif tool == "get_comps":
                self._extract_comps_panel(result)
            elif tool == "fmp_get_financials":
                self._extract_data_panel(result)
            elif tool == "yf_quote":
                self._extract_quote_metrics(result)

    def _handle_text_delta(self, event: HarnessEvent) -> None:
        content = event.data.get("content", "")
        if not content:
            return

        open_idx = content.find("<thinking>")
        close_idx = content.find("</thinking>")

        if open_idx != -1 and close_idx != -1 and close_idx > open_idx:
            # Both open and close in same chunk
            before = content[:open_idx]
            inside = content[open_idx + 10:close_idx]
            after = content[close_idx + 11:]
            if before:
                self.accumulated_reasoning += before
            if inside:
                self.accumulated_thinking += inside + "\n---\n"
            # Emit thinking timeline entry
            self._emit_thinking_entry(inside)
            if after:
                self.accumulated_reasoning += after
            self._in_thinking = False
            self._current_thinking_buffer = ""
        elif open_idx != -1:
            # Entering thinking block
            before = content[:open_idx]
            after = content[open_idx + 10:]
            if before:
                self.accumulated_reasoning += before
            if after:
                self.accumulated_thinking += after
            self._in_thinking = True
            self._current_thinking_buffer = after
        elif close_idx != -1:
            # Exiting thinking block
            before = content[:close_idx]
            after = content[close_idx + 11:]
            if before:
                self.accumulated_thinking += before
                self._current_thinking_buffer += before
            self.accumulated_thinking += "\n---\n"
            # Emit thinking timeline entry with full block text
            self._emit_thinking_entry(self._current_thinking_buffer)
            if after:
                self.accumulated_reasoning += after
            self._in_thinking = False
            self._current_thinking_buffer = ""
        else:
            # No tags — route based on current state
            if self._in_thinking:
                self.accumulated_thinking += content
                self._current_thinking_buffer += content
            else:
                self.accumulated_reasoning += content

    def _emit_thinking_entry(self, full_text: str) -> None:
        """Add a thinking timeline entry with the full block text."""
        self.accumulated_timeline.append({
            "tool": "thinking",
            "status": "complete",
            "timestamp": time.time(),
            "fullText": full_text,
        })

    # ── Panel extraction helpers ──────────────────────────────

    def _extract_model_panel(self, result: dict) -> None:
        """Extract model panel data from build_dcf result."""
        model = self.accumulated_frontend_panels["model"]

        fv = result.get("fair_value_per_share")
        cp = result.get("current_price")
        gap = result.get("gap_pct")
        if fv is not None:
            model["fairValue"] = {
                "fairValue": fv,
                "currentPrice": cp or 0,
                "currency": "USD",
                "upside": gap or 0,
                "confidence": "medium",
            }

        # Implied multiples
        mult = result.get("implied_multiples")
        if mult and isinstance(mult, dict):
            multiples = []
            if mult.get("fwd_pe") is not None:
                multiples.append({"label": "Fwd P/E", "value": f"{mult['fwd_pe']}x"})
            if mult.get("ev_ebitda") is not None:
                multiples.append({"label": "EV/EBITDA", "value": f"{mult['ev_ebitda']}x"})
            if mult.get("fcf_yield") is not None:
                multiples.append({"label": "FCF Yield", "value": f"{mult['fcf_yield'] * 100:.1f}%"})
            if mult.get("peg_ratio") is not None:
                multiples.append({"label": "PEG", "value": f"{mult['peg_ratio']}x"})
            if multiples:
                model["impliedMultiples"] = multiples

        # Sensitivity
        sens = result.get("sensitivity")
        if sens and isinstance(sens, dict):
            wacc_vals = sens.get("wacc_values", [])
            growth_vals = sens.get("growth_values", [])
            matrix = sens.get("matrix", [])
            row_vals = [f"{v * 100:.1f}%" for v in wacc_vals]
            col_vals = [f"{v * 100:.1f}%" for v in growth_vals]
            cells = []
            for i, row in enumerate(matrix):
                for j, val in enumerate(row if row else []):
                    if val is not None:
                        cells.append({
                            "row": row_vals[i] if i < len(row_vals) else "",
                            "col": col_vals[j] if j < len(col_vals) else "",
                            "value": val,
                            "isBase": (
                                i == len(wacc_vals) // 2
                                and j == len(growth_vals) // 2
                            ),
                        })
            if cells:
                model["sensitivityData"] = cells
                model["sensitivityRowValues"] = row_vals
                model["sensitivityColValues"] = col_vals

        # Year-by-year
        yby = result.get("year_by_year")
        if yby and isinstance(yby, list):
            projections = []
            for row in yby:
                revenue = row.get("revenue", 0)
                ebit = row.get("ebit", 0)
                projections.append({
                    "year": f"Y{row.get('year', '?')}",
                    "revenue": revenue,
                    "growth": 0,
                    "ebitda": ebit,
                    "margin": (ebit / revenue * 100) if revenue else 0,
                    "fcf": row.get("fcf", 0),
                })
            if projections:
                model["yearByYear"] = projections

        model["loading"] = False

    def _extract_comps_panel(self, result: dict) -> None:
        """Extract comps panel data from get_comps result."""
        comps = self.accumulated_frontend_panels["comps"]
        raw_peers = result.get("peers", [])

        peers = []
        scatter = []
        for p in raw_peers:
            peers.append({
                "ticker": p.get("ticker", ""),
                "name": p.get("ticker", ""),
                "marketCap": 0,
                "peRatio": p.get("fwd_pe", 0) or 0,
                "evEbitda": p.get("ev_ebitda", 0) or 0,
                "revenueGrowth": p.get("revenue_growth", 0) or 0,
                "margin": p.get("gross_margin", 0) or 0,
            })
            if p.get("ev_ebitda") is not None and p.get("revenue_growth") is not None:
                scatter.append({
                    "ticker": p.get("ticker", ""),
                    "x": p.get("ev_ebitda", 0) or 0,
                    "y": (p.get("revenue_growth", 0) or 0) * 100,
                    "isTarget": p.get("is_target", False),
                })

        if peers:
            comps["peers"] = peers
        if scatter:
            comps["scatterData"] = scatter
        comps["loading"] = False

    def _extract_data_panel(self, result: dict) -> None:
        """Extract data panel from fmp_get_financials result."""
        data_panel = self.accumulated_frontend_panels["data"]
        st_type = result.get("statement_type", "")
        raw_data = result.get("data", [])
        if not raw_data:
            return

        if st_type == "profile":
            p = raw_data[0] if raw_data else {}
            metrics = []
            if p.get("price"):
                metrics.append({"label": "Price", "value": p["price"], "unit": "USD"})
            if p.get("mktCap"):
                metrics.append({"label": "Market Cap", "value": f"{p['mktCap'] / 1e9:.1f}B", "unit": "USD"})
            if p.get("pe"):
                metrics.append({"label": "P/E", "value": f"{p['pe']:.1f}"})
            if p.get("beta"):
                metrics.append({"label": "Beta", "value": f"{p['beta']:.2f}"})
            if metrics:
                data_panel["metrics"].extend(metrics)
        else:
            # Financial statement — build a table
            titles = {
                "income-statement": "Income Statement",
                "balance-sheet-statement": "Balance Sheet",
                "cash-flow-statement": "Cash Flow",
                "ratios": "Ratios",
            }
            headers = [
                "Metric",
                *[
                    (r.get("calendarYear") or r.get("date", ""))[:4]
                    for r in raw_data
                ],
            ]

            key_fields: dict[str, list[str]] = {
                "income-statement": ["revenue", "grossProfit", "operatingIncome", "netIncome", "eps", "epsdiluted"],
                "balance-sheet-statement": ["totalAssets", "totalLiabilities", "totalEquity", "cashAndShortTermInvestments", "totalDebt"],
                "cash-flow-statement": ["operatingCashFlow", "capitalExpenditure", "freeCashFlow", "dividendsPaid"],
                "ratios": ["grossProfitMargin", "operatingProfitMargin", "netProfitMargin", "returnOnEquity", "debtEquityRatio"],
            }
            fields = key_fields.get(st_type)
            if not fields:
                latest = raw_data[0] if raw_data else {}
                fields = [k for k, v in latest.items() if isinstance(v, (int, float))][:8]

            rows = []
            for f in fields:
                values = []
                for r in raw_data:
                    v = r.get(f)
                    if v is None:
                        values.append("-")
                    elif isinstance(v, (int, float)):
                        if abs(v) >= 1e9:
                            values.append(f"{v / 1e9:.1f}B")
                        elif abs(v) >= 1e6:
                            values.append(f"{v / 1e6:.0f}M")
                        elif abs(v) < 1 and v != 0:
                            values.append(f"{v * 100:.1f}%")
                        else:
                            values.append(f"{v:.1f}")
                    else:
                        values.append(str(v))
                rows.append({"label": f, "values": values})

            ticker = result.get("ticker", "")
            table = {
                "title": f"{ticker} {titles.get(st_type, st_type)}",
                "headers": headers,
                "rows": rows,
            }
            data_panel["financialTables"].append(table)

        data_panel["loading"] = False

    def _extract_quote_metrics(self, result: dict) -> None:
        """Extract data panel metrics from yf_quote result."""
        data_panel = self.accumulated_frontend_panels["data"]
        ticker = result.get("ticker", "")
        metrics = []

        if result.get("price"):
            metrics.append({"label": f"{ticker} Price", "value": result["price"], "unit": result.get("currency", "USD")})
        if result.get("market_cap"):
            metrics.append({"label": "Market Cap", "value": f"${result['market_cap'] / 1e9:.1f}B"})
        if result.get("pe_trailing"):
            metrics.append({"label": "P/E (TTM)", "value": f"{result['pe_trailing']:.1f}"})
        if result.get("pe_forward"):
            metrics.append({"label": "Fwd P/E", "value": f"{result['pe_forward']:.1f}"})
        if result.get("ev_ebitda"):
            metrics.append({"label": "EV/EBITDA", "value": f"{result['ev_ebitda']:.1f}"})
        if result.get("dividend_yield"):
            metrics.append({"label": "Div Yield", "value": f"{result['dividend_yield'] * 100:.2f}%"})

        if metrics:
            data_panel["metrics"].extend(metrics)
        data_panel["loading"] = False

    # ── Snapshot ──────────────────────────────────────────────

    def snapshot(self) -> dict:
        """
        Return a snapshot of accumulated data for persistence.

        Returns dict with reasoning_text, thinking_text, timeline, panels.
        """
        return {
            "reasoning_text": self.accumulated_reasoning,
            "thinking_text": self.accumulated_thinking,
            "timeline": list(self.accumulated_timeline),
            "panels": self.accumulated_frontend_panels,
        }


def create_session(harness: Harness) -> AnalysisSession:
    """Create a new analysis session wrapping a harness instance."""
    return AnalysisSession(
        id=uuid.uuid4().hex[:16],
        harness=harness,
        events=queue.Queue(),
    )


# Global session registry
_sessions: dict[str, AnalysisSession] = {}
_sessions_lock = threading.Lock()


def get_session(session_id: str) -> AnalysisSession | None:
    with _sessions_lock:
        return _sessions.get(session_id)


def register_session(session: AnalysisSession) -> None:
    with _sessions_lock:
        _sessions[session.id] = session


def remove_session(session_id: str) -> None:
    with _sessions_lock:
        _sessions.pop(session_id, None)


def all_sessions() -> dict[str, AnalysisSession]:
    with _sessions_lock:
        return dict(_sessions)
