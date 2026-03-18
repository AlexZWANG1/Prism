"""
User-input tool: allows the harness to pause and ask the user a question.

The tool blocks the harness thread via threading.Event until the user
responds through the /api/analyze/{id}/respond endpoint.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from tools.base import ToolResult, make_tool_schema

if TYPE_CHECKING:
    from backend.sessions import AnalysisSession

# Timeout for waiting on user response (seconds)
_USER_INPUT_TIMEOUT = 300

REQUEST_USER_INPUT_SCHEMA = make_tool_schema(
    name="request_user_input",
    description="Ask the user a question during analysis. Use sparingly — 0-1 times per analysis.",
    properties={
        "question": {"type": "string"},
        "context": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}},
    },
    required=["question", "context"],
)


def request_user_input(
    question: str,
    context: str,
    options: list[str] | None = None,
    *,
    session: "AnalysisSession",
) -> ToolResult:
    """
    Ask the user a question during analysis.

    This function blocks the harness thread until the user responds
    or the timeout expires.
    """
    # Put event into session queue so SSE stream sends it to the client
    session.events.put({
        "event": "user_input_needed",
        "data": {
            "question": question,
            "context": context,
            "options": options,
        },
    })

    # Mark session as waiting for user input
    session.status = "waiting"
    session.user_input_event.clear()
    session.user_input_response = None

    # Block until user responds or timeout
    got_response = session.user_input_event.wait(timeout=_USER_INPUT_TIMEOUT)

    if not got_response:
        session.status = "running"
        return ToolResult.fail(
            "User did not respond within timeout",
            hint="The analysis will continue without user input",
            recoverable=True,
        )

    response = session.user_input_response
    session.status = "running"
    session.user_input_response = None

    return ToolResult.ok({
        "response": response,
        "question": question,
    })
