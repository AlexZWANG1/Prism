"""
Evaluator — independent quality auditor for deep analysis mode.

Reads evidence + conclusion from RunDirectory (Generator cannot filter).
Receives query + tool_log as lightweight params.
Returns structured EvalResult with pass/fail + actionable feedback.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

from core.budget import BudgetTracker
from core.run_directory import RunDirectory
from llm.base import LLMClient

log = logging.getLogger(__name__)

# ── Soul prompt for the evaluator ────────────────────────────

_SOUL_DIR = Path(__file__).resolve().parent.parent / "soul"


def _load_evaluator_prompt() -> str:
    p = _SOUL_DIR / "evaluator.md"
    if p.exists():
        return p.read_text(encoding="utf-8")
    return (
        "You are a quality auditor for investment analysis. "
        "Cross-check the conclusion against raw evidence. "
        "Return JSON with: overall_score (1-5), passed (bool), "
        "feedback (specific correction instructions), "
        "issues (list of {field, expected, actual, severity})."
    )


# ── Data classes ─────────────────────────────────────────────

@dataclass
class EvalIssue:
    field: str
    expected: str
    actual: str
    severity: str = "medium"  # low / medium / high

    def to_dict(self) -> dict:
        return {"field": self.field, "expected": self.expected,
                "actual": self.actual, "severity": self.severity}


@dataclass
class EvalResult:
    overall_score: float  # 1.0 – 5.0
    passed: bool
    feedback: str  # actionable correction text
    issues: list[EvalIssue] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "overall_score": self.overall_score,
            "passed": self.passed,
            "feedback": self.feedback,
            "issues": [i.to_dict() for i in self.issues],
        }


# ── Evaluator ────────────────────────────────────────────────

@dataclass
class EvaluatorConfig:
    pass_threshold: float = 3.0
    min_tools_for_eval: int = 2


class Evaluator:
    """Independent QA auditor for deep analysis results."""

    def __init__(
        self,
        llm: LLMClient,
        config: EvaluatorConfig,
        run_dir: RunDirectory,
    ):
        self.llm = llm
        self.config = config
        self.run_dir = run_dir
        self._system_prompt = _load_evaluator_prompt()

    def should_evaluate(self, tool_log: list[dict]) -> bool:
        """Gate: skip eval for trivial queries that barely used tools."""
        ok_tools = [t for t in tool_log if t.get("status") == "ok"]
        return len(ok_tools) >= self.config.min_tools_for_eval

    def evaluate(
        self,
        query: str,
        round_num: int,
        tool_log: list[dict],
        budget: BudgetTracker | None = None,
    ) -> EvalResult:
        """Run independent quality evaluation.

        Evidence + conclusion are read from disk (independent of Generator).
        Query + tool_log are passed as lightweight params.
        """
        # ── Independent data from disk ──
        conclusion = self.run_dir.read_conclusion(round_num)
        evidence = self.run_dir.read_latest_evidence()

        # ── Lightweight params ──
        tools_called = [t["tool"] for t in tool_log if t.get("status") == "ok"]
        tools_failed = [t["tool"] for t in tool_log if t.get("status") != "ok"]

        # ── Build evaluator's own messages ──
        evidence_text = self._format_evidence(evidence)
        user_content = (
            f"## User Query\n{query}\n\n"
            f"## Tools Called\nSuccess: {', '.join(tools_called) or 'none'}\n"
            f"{'Failed: ' + ', '.join(tools_failed) if tools_failed else ''}\n\n"
            f"## Generator Conclusion\n{conclusion[:8000]}\n\n"
            f"## Raw Evidence (tool outputs)\n{evidence_text[:20000]}"
        )

        try:
            response = self.llm.chat(
                messages=[
                    {"role": "system", "content": self._system_prompt},
                    {"role": "user", "content": user_content},
                ],
                tools=[],
                temperature=0.1,
            )

            # Track evaluator LLM cost in budget
            if budget:
                budget.register_llm_call(
                    "evaluator",
                    response.input_tokens,
                    response.output_tokens,
                )

            result = self._parse_response(response.content or "")

        except Exception as e:
            log.error("Evaluator LLM call failed: %s", e)
            # On failure, pass through (don't block the analysis)
            result = EvalResult(
                overall_score=3.0, passed=True,
                feedback=f"Evaluator error: {e}",
            )

        # Persist eval report
        self.run_dir.write_eval_report(round_num, result.to_dict())
        return result

    def _format_evidence(self, evidence: dict[str, dict]) -> str:
        parts = []
        for tool_name, data in evidence.items():
            serialized = json.dumps(data, ensure_ascii=False, default=str)
            if len(serialized) > 4000:
                serialized = serialized[:4000] + "...[truncated]"
            parts.append(f"### {tool_name}\n```json\n{serialized}\n```")
        return "\n\n".join(parts)

    def _parse_response(self, text: str) -> EvalResult:
        """Parse LLM response into EvalResult. Expects JSON."""
        # Try to extract JSON from the response
        try:
            # Handle markdown code blocks
            if "```json" in text:
                text = text.split("```json", 1)[1].split("```", 1)[0]
            elif "```" in text:
                text = text.split("```", 1)[1].split("```", 1)[0]

            data = json.loads(text.strip())
        except (json.JSONDecodeError, IndexError):
            # Fallback: treat as free-text feedback, assume marginal
            log.warning("Evaluator returned non-JSON, treating as feedback")
            return EvalResult(
                overall_score=2.5,
                passed=False,
                feedback=text[:2000],
            )

        score = float(data.get("overall_score", 2.5))
        passed = bool(data.get("passed", score >= self.config.pass_threshold))
        feedback = data.get("feedback", "")

        issues = []
        for iss in data.get("issues", []):
            if isinstance(iss, dict):
                issues.append(EvalIssue(
                    field=iss.get("field", "unknown"),
                    expected=str(iss.get("expected", "")),
                    actual=str(iss.get("actual", "")),
                    severity=iss.get("severity", "medium"),
                ))

        return EvalResult(
            overall_score=score,
            passed=passed,
            feedback=feedback,
            issues=issues,
        )
