"""
SSE bridge: maps HarnessEvent → SSE-formatted dicts.

Events that are internal-only (RUN_START, RUN_END, TURN_START, TURN_END)
are suppressed (return None). All other events are translated to a dict
with 'event' (SSE type) and 'data' (JSON-serializable payload).
"""

from __future__ import annotations

import json
from typing import Any

from core.harness import EventType, HarnessEvent

# Maximum bytes for tool result in SSE payloads (10 KB)
_MAX_RESULT_SIZE = 10 * 1024

# Events that are not forwarded to clients
_SKIP_EVENTS = frozenset({
    EventType.RUN_START,
    EventType.RUN_END,
    EventType.TURN_START,
    EventType.TURN_END,
})


def harness_event_to_sse(event: HarnessEvent) -> dict | None:
    """
    Convert a HarnessEvent to an SSE-formatted dict.

    Returns a dict with keys 'event' (str) and 'data' (dict),
    or None if the event should be skipped.
    """
    if event.type in _SKIP_EVENTS:
        return None

    handler = _HANDLERS.get(event.type)
    if handler is None:
        return None

    return handler(event)


def _handle_tool_start(event: HarnessEvent) -> dict:
    return {
        "event": "tool_start",
        "data": {
            "tool": event.data.get("tool"),
            "args": event.data.get("args"),
        },
    }


def _handle_tool_end(event: HarnessEvent) -> dict:
    result = event.data.get("result")
    if result is not None:
        serialized = json.dumps(result, ensure_ascii=False, default=str)
        if len(serialized) > _MAX_RESULT_SIZE:
            serialized = serialized[:_MAX_RESULT_SIZE] + "...[truncated]"
            result = serialized
    return {
        "event": "tool_end",
        "data": {
            "tool": event.data.get("tool"),
            "status": event.data.get("status"),
            "result": result,
        },
    }


def _handle_text_delta(event: HarnessEvent) -> dict:
    content = event.data.get("content", "")
    return {
        "event": "text_delta",
        "data": {
            "content": content,
            "isThinking": "<thinking>" in content or "</thinking>" in content,
        },
    }


def _handle_text(event: HarnessEvent) -> dict:
    return {
        "event": "text",
        "data": {
            "content": event.data.get("content"),
        },
    }


def _handle_context_compacted(event: HarnessEvent) -> dict:
    return {
        "event": "context_compacted",
        "data": {},
    }


def _handle_retry(event: HarnessEvent) -> dict:
    return {
        "event": "retry",
        "data": {
            "attempt": event.data.get("attempt"),
            "reason": event.data.get("error"),
        },
    }


def _handle_aborted(event: HarnessEvent) -> dict:
    return {
        "event": "error",
        "data": {
            "message": event.data.get("message", "Analysis aborted"),
            "recoverable": False,
        },
    }


def _handle_loop_detected(event: HarnessEvent) -> dict:
    detectors = event.data.get("detectors", [])
    loop_type = ", ".join(detectors) if detectors else "unknown"
    return {
        "event": "system",
        "data": {
            "message": f"Loop detected: {loop_type}",
        },
    }


def _handle_budget_trimmed(event: HarnessEvent) -> dict:
    planned = event.data.get("planned", "?")
    allowed = event.data.get("allowed", "?")
    return {
        "event": "system",
        "data": {
            "message": f"Budget trimmed: {planned} planned → {allowed} allowed",
        },
    }


def _handle_steering_injected(event: HarnessEvent) -> dict:
    return {
        "event": "steering",
        "data": {
            "message": event.data.get("message", ""),
        },
    }


_HANDLERS = {
    EventType.TOOL_START: _handle_tool_start,
    EventType.TOOL_END: _handle_tool_end,
    EventType.TEXT_DELTA: _handle_text_delta,
    EventType.TEXT: _handle_text,
    EventType.CONTEXT_COMPACTED: _handle_context_compacted,
    EventType.RETRY: _handle_retry,
    EventType.ABORTED: _handle_aborted,
    EventType.LOOP_DETECTED: _handle_loop_detected,
    EventType.BUDGET_TRIMMED: _handle_budget_trimmed,
    EventType.STEERING_INJECTED: _handle_steering_injected,
}
