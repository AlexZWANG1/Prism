"""
Run directory management for deep analysis mode.

Each deep analysis run gets a directory under a configurable base path:
  {base_dir}/run_{id}/
    state.json
    evidence/round_{N}/{tool_name}.json
    conclusions/round_{N}.md
    eval_reports/round_{N}.json

Evidence is versioned by round so re-called tools don't overwrite prior data.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

# Internal tools whose results are NOT evidence for the evaluator.
# Everything else counts as evidence.
_INTERNAL_TOOLS = frozenset({
    "remember", "recall", "search_knowledge",
    "create_hypothesis", "add_evidence_card",
    "request_user_input",
})


class RunDirectory:
    """Manages on-disk artifacts for a single deep-analysis run."""

    def __init__(self, run_id: str, base_dir: str | None = None):
        if base_dir is None:
            base_dir = str(Path(tempfile.gettempdir()) / "iris_runs")
        self.path = Path(base_dir) / run_id
        self.path.mkdir(parents=True, exist_ok=True)

    def _ensure_round_dir(self, subdir: str, round_num: int) -> Path:
        d = self.path / subdir / f"round_{round_num}"
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ── Evidence ──────────────────────────────────────────────

    def write_evidence_batch(self, round_num: int, tool_evidence: dict):
        """Write tool results for a specific round.

        tool_evidence: {tool_name: result_data} accumulated during _main_loop.
        Skips internal tools (memory, hypothesis, etc.).
        """
        if not tool_evidence:
            return
        d = self._ensure_round_dir("evidence", round_num)
        for tool_name, data in tool_evidence.items():
            if tool_name in _INTERNAL_TOOLS or data is None:
                continue
            (d / f"{tool_name}.json").write_text(
                json.dumps(data, ensure_ascii=False, default=str),
                encoding="utf-8",
            )

    def read_all_evidence(self) -> dict[int, dict[str, dict]]:
        """Read evidence from all rounds.

        Returns: {round_num: {tool_name: data}}
        """
        evidence: dict[int, dict[str, dict]] = {}
        evidence_root = self.path / "evidence"
        if not evidence_root.exists():
            return evidence
        for round_dir in sorted(evidence_root.iterdir()):
            if not round_dir.is_dir() or not round_dir.name.startswith("round_"):
                continue
            rnum = int(round_dir.name.split("_", 1)[1])
            evidence[rnum] = {}
            for f in round_dir.glob("*.json"):
                try:
                    evidence[rnum][f.stem] = json.loads(f.read_text(encoding="utf-8"))
                except (json.JSONDecodeError, OSError):
                    pass
        return evidence

    def read_latest_evidence(self) -> dict[str, dict]:
        """Read the most recent version of each tool's evidence across all rounds."""
        all_ev = self.read_all_evidence()
        merged: dict[str, dict] = {}
        for rnum in sorted(all_ev.keys()):
            merged.update(all_ev[rnum])
        return merged

    # ── Conclusions ───────────────────────────────────────────

    def write_conclusion(self, round_num: int, text: str):
        (self.path / "conclusions").mkdir(parents=True, exist_ok=True)
        (self.path / "conclusions" / f"round_{round_num}.md").write_text(
            text, encoding="utf-8",
        )

    def read_conclusion(self, round_num: int) -> str:
        p = self.path / "conclusions" / f"round_{round_num}.md"
        return p.read_text(encoding="utf-8") if p.exists() else ""

    # ── Eval Reports ─────────────────────────────────────────

    def write_eval_report(self, round_num: int, report: dict):
        (self.path / "eval_reports").mkdir(parents=True, exist_ok=True)
        (self.path / "eval_reports" / f"round_{round_num}.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )

    # ── State ────────────────────────────────────────────────

    def read_state(self) -> dict:
        p = self.path / "state.json"
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        return {}

    def write_state(self, state: dict):
        (self.path / "state.json").write_text(
            json.dumps(state, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
