"""
Session management for IRIS backend.

Each analysis run gets an AnalysisSession that bridges the harness thread
with the async FastAPI layer via a threading.Queue.
"""

from __future__ import annotations

import queue
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

from core.harness import Harness


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

    def touch(self) -> None:
        """Update last_activity timestamp."""
        self.last_activity = datetime.now(timezone.utc)


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
