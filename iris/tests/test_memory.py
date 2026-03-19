"""Tests for tools/memory.py"""

import json
import pytest
from pathlib import Path
from unittest.mock import patch

from tools.memory import (
    recall_memory, save_memory, check_calibration,
    _memory_base,
)


@pytest.fixture
def memory_dir(tmp_path):
    """Set up a temporary memory directory."""
    mem = tmp_path / "memory"
    (mem / "companies").mkdir(parents=True)
    (mem / "sectors").mkdir(parents=True)
    (mem / "patterns").mkdir(parents=True)
    (mem / "calibration").mkdir(parents=True)
    with patch("tools.memory.config_get", return_value=str(mem)):
        with patch("tools.memory._memory_base", return_value=mem):
            yield mem


def test_recall_memory_no_file(memory_dir):
    with patch("tools.memory._memory_base", return_value=memory_dir):
        result = recall_memory(company="NVDA", memory_type="company")
    assert result.status == "ok"
    assert result.data["content"] is None
    assert "No prior memory" in result.data["message"]


def test_save_and_recall(memory_dir):
    content = "# NVDA Analysis\nFair Value: $165\nThesis: AI dominance"
    with patch("tools.memory._memory_base", return_value=memory_dir):
        save_result = save_memory(company="NVDA", memory_type="company", content=content)
        assert save_result.status == "ok"
        assert "companies/NVDA.md" in save_result.data["path"]

        recall_result = recall_memory(company="NVDA", memory_type="company")
        assert recall_result.status == "ok"
        assert recall_result.data["content"] == content


def test_save_creates_directory(memory_dir):
    # Use a fresh subdir that doesn't exist
    new_mem = memory_dir / "fresh"
    with patch("tools.memory._memory_base", return_value=new_mem):
        result = save_memory(company="TSLA", memory_type="company", content="# TSLA")
    assert result.status == "ok"
    assert (new_mem / "companies" / "TSLA.md").exists()


def test_save_overwrites(memory_dir):
    with patch("tools.memory._memory_base", return_value=memory_dir):
        save_memory(company="NVDA", memory_type="company", content="V1")
        save_memory(company="NVDA", memory_type="company", content="V2")
        result = recall_memory(company="NVDA", memory_type="company")
    assert result.data["content"] == "V2"


def test_save_company_appends_calibration(memory_dir):
    """Calibration now reads fair_value from DB, not regex.
    Without a DB valuation record, no calibration entry is created."""
    content = "# NVDA\nFair Value: $165.50\nBuy recommendation."
    with patch("tools.memory._memory_base", return_value=memory_dir):
        save_memory(company="NVDA", memory_type="company", content=content)
    log_path = memory_dir / "calibration" / "prediction_log.jsonl"
    # No calibration entry since no DB valuation exists
    if log_path.exists():
        lines = log_path.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 0 or lines == [""]
    # This is correct behavior: no valuation in DB = no calibration entry


def test_check_calibration_empty(memory_dir):
    with patch("tools.memory._memory_base", return_value=memory_dir):
        result = check_calibration()
    assert result.status == "ok"
    assert result.data["summary"]["totalPredictions"] == 0


def test_check_calibration_filters_company(memory_dir):
    log_path = memory_dir / "calibration" / "prediction_log.jsonl"
    entries = [
        {"date": "2026-01-01", "company": "NVDA", "metric": "fair_value", "predicted": 165, "actual": 150},
        {"date": "2026-01-01", "company": "AMD", "metric": "fair_value", "predicted": 120, "actual": 110},
        {"date": "2026-02-01", "company": "NVDA", "metric": "fair_value", "predicted": 170, "actual": 155},
    ]
    with open(log_path, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e) + "\n")

    with patch("tools.memory._memory_base", return_value=memory_dir):
        result = check_calibration(company="NVDA")
    assert result.status == "ok"
    assert result.data["summary"]["totalPredictions"] == 2


def test_check_calibration_bias_detection(memory_dir):
    log_path = memory_dir / "calibration" / "prediction_log.jsonl"
    # 3 consecutive underestimates
    entries = [
        {"date": "2026-01-01", "company": "NVDA", "metric": "fair_value", "predicted": 140, "actual": 150},
        {"date": "2026-02-01", "company": "NVDA", "metric": "fair_value", "predicted": 145, "actual": 160},
        {"date": "2026-03-01", "company": "NVDA", "metric": "fair_value", "predicted": 150, "actual": 165},
    ]
    with open(log_path, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e) + "\n")

    with patch("tools.memory._memory_base", return_value=memory_dir):
        result = check_calibration(company="NVDA")
    assert result.status == "ok"
    assert result.data["summary"]["biasDirection"] == "underestimate"


def test_recall_sector(memory_dir):
    with patch("tools.memory._memory_base", return_value=memory_dir):
        save_memory(company="semiconductors", memory_type="sector", content="# Semiconductors")
        result = recall_memory(company="semiconductors", memory_type="sector")
    assert result.status == "ok"
    assert result.data["content"] == "# Semiconductors"


def test_recall_patterns(memory_dir):
    with patch("tools.memory._memory_base", return_value=memory_dir):
        save_memory(company="mean_reversion", memory_type="patterns", content="# Mean Reversion")
        result = recall_memory(company="mean_reversion", memory_type="patterns")
    assert result.status == "ok"
    assert result.data["content"] == "# Mean Reversion"


def test_save_memory_tool_result_format(memory_dir):
    with patch("tools.memory._memory_base", return_value=memory_dir):
        result = save_memory(company="NVDA", memory_type="company", content="# Test")
    assert result.status == "ok"
    assert "path" in result.data


def test_recall_calibration_type(memory_dir):
    log_path = memory_dir / "calibration" / "prediction_log.jsonl"
    entries = [
        {"date": "2026-01-01", "company": "NVDA", "metric": "fair_value", "predicted": 165, "actual": None},
    ]
    with open(log_path, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e) + "\n")

    with patch("tools.memory._memory_base", return_value=memory_dir):
        result = recall_memory(company="NVDA", memory_type="calibration")
    assert result.status == "ok"
    assert result.data["content"] is not None
    assert len(result.data["content"]) == 1


def test_regex_extraction_removed():
    """_extract_fair_value was deleted — calibration now uses DB."""
    import tools.memory as mem
    assert not hasattr(mem, "_extract_fair_value")


def test_cannot_save_calibration_directly(memory_dir):
    with patch("tools.memory._memory_base", return_value=memory_dir):
        result = save_memory(company="NVDA", memory_type="calibration", content="bad")
    assert result.status == "error"
