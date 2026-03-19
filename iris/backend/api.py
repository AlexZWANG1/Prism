"""
IRIS FastAPI backend — REST + SSE API wrapping the Harness agent loop.
"""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

import asyncio
import functools
import json
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.config import get as config_get
from core.harness import HarnessEvent
from backend.sessions import (
    AnalysisSession,
    all_sessions,
    create_session,
    get_session,
    register_session,
    remove_session,
)
from backend.sse_bridge import harness_event_to_sse
from backend.user_input_tool import (
    REQUEST_USER_INPUT_SCHEMA,
    request_user_input,
)
from tools.base import Tool
from tools.memory import check_calibration

# ── App setup ─────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start cleanup thread on startup."""
    global _cleanup_thread
    _cleanup_thread = threading.Thread(target=_cleanup_loop, daemon=True)
    _cleanup_thread.start()
    yield


app = FastAPI(title="IRIS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ────────────────────────────────

class AnalyzeRequest(BaseModel):
    query: str
    contextDocs: Optional[list[str]] = None


class AnalyzeResponse(BaseModel):
    analysisId: str
    streamUrl: str


class SteerRequest(BaseModel):
    message: str


class RespondRequest(BaseModel):
    response: str


class MemoryWriteRequest(BaseModel):
    content: str


# ── Memory helpers ───────────────────────────────────────────

_MEMORY_TYPES = ("companies", "sectors", "patterns", "calibration")


def _memory_base() -> Path:
    base = config_get("memory.base_dir", "./memory")
    return Path(base)


def _validate_memory_type(memory_type: str) -> None:
    if memory_type not in _MEMORY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid memory type: {memory_type}. Must be one of {_MEMORY_TYPES}",
        )


def _memory_file_path(memory_type: str, filename: str) -> Path:
    _validate_memory_type(memory_type)
    base = _memory_base()
    return base / memory_type / filename


# ── Analysis endpoints ───────────────────────────────────────

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def start_analysis(req: AnalyzeRequest):
    """Start a new analysis run. Returns session ID and SSE stream URL."""
    from main import build_harness

    # Build harness with event callback that feeds the session queue
    harness, _retriever = build_harness(streaming=True)

    session = create_session(harness)

    # Create the on_event callback that pushes to session.events
    def on_event(event: HarnessEvent) -> None:
        sse = harness_event_to_sse(event)
        if sse is not None:
            session.events.put(sse)
            session.touch()
        session.accumulate_raw(event)  # raw event, not truncated

    harness.on_event = on_event

    # Register request_user_input as an additional tool with session bound
    bound_fn = functools.partial(request_user_input, session=session)
    user_input_tool = Tool(bound_fn, REQUEST_USER_INPUT_SCHEMA)
    harness.tool_registry[user_input_tool.name] = user_input_tool

    register_session(session)

    # Run harness in background thread
    def _run():
        try:
            result = harness.run(req.query, context_docs=req.contextDocs)
            session.events.put({
                "event": "analysis_complete",
                "data": {
                    "ok": result.ok,
                    "reply": result.reply,
                    "error": result.error,
                    "runId": result.run_id,
                    "totalInputTokens": result.total_input_tokens,
                    "totalOutputTokens": result.total_output_tokens,
                    "toolLog": result.tool_log,
                },
            })
            session.status = "complete"
        except Exception as e:
            session.events.put({
                "event": "error",
                "data": {
                    "message": str(e),
                    "recoverable": False,
                },
            })
            session.status = "error"
        finally:
            # Sentinel to signal SSE stream end
            session.events.put(None)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    return AnalyzeResponse(
        analysisId=session.id,
        streamUrl=f"/api/analyze/{session.id}/stream",
    )


@app.get("/api/analyze/{analysis_id}/stream")
async def stream_events(analysis_id: str):
    """SSE endpoint — streams harness events to the client."""
    session = get_session(analysis_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    async def event_generator():
        loop = asyncio.get_event_loop()
        while True:
            try:
                # Read from threading.Queue in executor to avoid blocking event loop
                event = await loop.run_in_executor(None, functools.partial(session.events.get, timeout=30))
            except Exception:
                # Queue.get timeout — send keepalive
                yield ": keepalive\n\n"
                continue

            if event is None:
                # Sentinel: stream end
                yield f"event: done\ndata: {{}}\n\n"
                break

            event_type = event.get("event", "message")
            data = json.dumps(event.get("data", {}), ensure_ascii=False, default=str)
            yield f"event: {event_type}\ndata: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/analyze/{analysis_id}/steer")
async def steer_analysis(analysis_id: str, req: SteerRequest):
    """Inject a steering message into the running analysis."""
    session = get_session(analysis_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    session.harness.steer(req.message)
    session.touch()
    return {"ok": True}


@app.post("/api/analyze/{analysis_id}/respond")
async def respond_to_input(analysis_id: str, req: RespondRequest):
    """Respond to a user_input_needed event from the harness."""
    session = get_session(analysis_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    if session.status != "waiting":
        raise HTTPException(status_code=400, detail="Session is not waiting for input")

    session.user_input_response = req.response
    session.user_input_event.set()
    session.touch()
    return {"ok": True}


# ── Memory endpoints ─────────────────────────────────────────

@app.get("/api/memory")
async def list_memory():
    """Scan memory directory tree and return organized structure."""
    base = _memory_base()
    result = {
        "companies": [],
        "sectors": [],
        "patterns": [],
        "calibration": [],
    }

    for memory_type in _MEMORY_TYPES:
        type_dir = base / memory_type
        if not type_dir.exists():
            continue
        for f in sorted(type_dir.iterdir()):
            if f.is_file():
                result[memory_type].append(f.name)

    return result


@app.get("/api/memory/{memory_type}/{filename}")
async def read_memory(memory_type: str, filename: str):
    """Read a specific memory file."""
    path = _memory_file_path(memory_type, filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {memory_type}/{filename}")

    content = path.read_text(encoding="utf-8")
    return {"content": content, "path": f"{memory_type}/{filename}"}


@app.put("/api/memory/{memory_type}/{filename}")
async def write_memory(memory_type: str, filename: str, req: MemoryWriteRequest):
    """Write content to a memory file."""
    path = _memory_file_path(memory_type, filename)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(req.content, encoding="utf-8")
    return {"ok": True, "path": f"{memory_type}/{filename}"}


@app.delete("/api/memory/{memory_type}/{filename}")
async def delete_memory(memory_type: str, filename: str):
    """Delete a memory file."""
    path = _memory_file_path(memory_type, filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {memory_type}/{filename}")

    path.unlink()
    return {"ok": True, "path": f"{memory_type}/{filename}"}


# ── Watchlist endpoint ───────────────────────────────────────

@app.get("/api/watchlist")
async def get_watchlist():
    """
    Scan memory/companies/*.md and parse for watchlist data.
    Returns ticker, fair_value, market_price, gap, thesis, and alerts.
    """
    base = _memory_base()
    companies_dir = base / "companies"
    if not companies_dir.exists():
        return []

    watchlist = []
    for f in sorted(companies_dir.iterdir()):
        if not f.is_file() or not f.name.endswith(".md"):
            continue

        content = f.read_text(encoding="utf-8")
        ticker = f.stem.upper()

        entry = _parse_company_file(ticker, content, f)
        watchlist.append(entry)

    return watchlist


def _parse_company_file(ticker: str, content: str, path: Path) -> dict:
    """Parse a company markdown file for watchlist fields."""
    fair_value = _extract_number(content, r"(?:Fair\s+Value|fair_value|公允价值)[:\s]*\$?([\d,.]+)")
    market_price = _extract_number(content, r"(?:Market\s+Price|market_price|市场价格)[:\s]*\$?([\d,.]+)")

    gap = None
    if fair_value is not None and market_price is not None and market_price != 0:
        gap = round((fair_value - market_price) / market_price, 4)

    thesis = _extract_section(content, r"(?:##?\s*(?:Thesis|投资论点|Investment Thesis))\s*\n(.*?)(?=\n##|\Z)")

    alerts = _compute_alerts(content, path)

    return {
        "ticker": ticker,
        "fair_value": fair_value,
        "market_price": market_price,
        "gap": gap,
        "thesis": thesis,
        "alerts": alerts,
    }


def _extract_number(content: str, pattern: str) -> float | None:
    match = re.search(pattern, content, re.IGNORECASE)
    if match:
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            return None
    return None


def _extract_section(content: str, pattern: str) -> str | None:
    match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip()[:500]
    return None


def _compute_alerts(content: str, path: Path) -> list[dict]:
    """Compute alert rules for a company file."""
    alerts = []

    # stale_analysis: file modified >30 days ago
    try:
        mtime = datetime.fromtimestamp(path.stat().st_mtime)
        now = datetime.now(timezone.utc)
        if mtime.tzinfo is None:
            mtime = mtime.replace(tzinfo=timezone.utc)
        if now - mtime > timedelta(days=30):
            alerts.append({
                "type": "stale_analysis",
                "message": f"Analysis is {(now - mtime).days} days old",
            })
    except OSError:
        pass

    # kill_triggered: look for checked kill criteria [x] or [X]
    kill_section = _extract_kill_section(content)
    if kill_section:
        checked = re.findall(r"\[[\s]*[xX][\s]*\]", kill_section)
        if checked:
            alerts.append({
                "type": "kill_triggered",
                "message": f"{len(checked)} kill criteria triggered",
            })

    # calibration_warning: 3+ consecutive same-direction errors >5%
    cal_warning = _check_calibration_warning(content)
    if cal_warning:
        alerts.append(cal_warning)

    return alerts


def _extract_kill_section(content: str) -> str | None:
    """Extract the kill criteria section from markdown."""
    match = re.search(
        r"(?:##?\s*(?:Kill\s+Criteria|终止条件))\s*\n(.*?)(?=\n##|\Z)",
        content,
        re.IGNORECASE | re.DOTALL,
    )
    return match.group(1) if match else None


def _check_calibration_warning(content: str) -> dict | None:
    """
    Check for calibration warning: 3+ consecutive same-direction errors >5%.
    Looks for a calibration section with error percentages.
    """
    errors_section = re.findall(
        r"(?:error|误差)[:\s]*([+-]?\d+(?:\.\d+)?)\s*%",
        content,
        re.IGNORECASE,
    )
    if len(errors_section) < 3:
        return None

    errors = []
    for e in errors_section:
        try:
            errors.append(float(e) / 100.0)
        except ValueError:
            continue

    if len(errors) < 3:
        return None

    # Check last 3+ consecutive same direction >5%
    consecutive = 0
    last_sign = None
    for e in reversed(errors):
        sign = 1 if e > 0 else -1
        if abs(e) > 0.05:
            if last_sign is None or sign == last_sign:
                consecutive += 1
                last_sign = sign
            else:
                break
        else:
            break

    if consecutive >= 3:
        direction = "overestimate" if last_sign > 0 else "underestimate"
        return {
            "type": "calibration_warning",
            "message": f"{consecutive} consecutive {direction} errors >5%",
        }

    return None


# ── Calibration endpoint ─────────────────────────────────────

@app.get("/api/calibration")
async def get_calibration(company: Optional[str] = Query(default=None)):
    """Delegate to check_calibration() tool."""
    result = check_calibration(company=company)
    return result.to_dict()


# ── Session cleanup background task ─────────────────────────

_cleanup_thread: threading.Thread | None = None


def _cleanup_loop():
    """Remove sessions inactive for >30 minutes. Runs every 60 seconds."""
    while True:
        time.sleep(60)
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
        sessions = all_sessions()
        for sid, session in sessions.items():
            if session.last_activity < cutoff:
                remove_session(sid)


