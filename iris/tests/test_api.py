"""
Tests for the IRIS FastAPI backend.

Uses FastAPI TestClient with mocked harness components.
"""

from __future__ import annotations

import json
import os
import sys
import threading
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure project root is on sys.path
_project_root = Path(__file__).parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from core.harness import EventType, HarnessEvent
from backend.sse_bridge import harness_event_to_sse


# ── Fixtures ─────────────────────────────────────────────────

@pytest.fixture
def tmp_memory(tmp_path, monkeypatch):
    """Set up a temporary memory directory and patch config_get."""
    for subdir in ("companies", "sectors", "patterns", "calibration"):
        (tmp_path / subdir).mkdir()

    def fake_config_get(key, default=None):
        if key == "memory.base_dir":
            return str(tmp_path)
        return default

    monkeypatch.setattr("backend.api.config_get", fake_config_get)
    monkeypatch.setattr("tools.memory.config_get", fake_config_get)
    return tmp_path


@pytest.fixture
def client(tmp_memory):
    """Create a TestClient with cleanup thread suppressed."""
    from fastapi.testclient import TestClient
    from backend.api import app

    # Patch _cleanup_loop to be a no-op so the background thread exits immediately
    with patch("backend.api._cleanup_loop"):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c


@pytest.fixture
def mock_build_harness():
    """Mock build_harness to return a controllable harness."""
    mock_harness = MagicMock()
    mock_harness.steer = MagicMock()
    mock_harness.tool_registry = {}

    # Make run() complete quickly with a result
    mock_result = MagicMock()
    mock_result.ok = True
    mock_result.reply = "Test analysis complete"
    mock_result.error = None
    mock_result.run_id = "run_test123"
    mock_result.total_input_tokens = 100
    mock_result.total_output_tokens = 50
    mock_result.tool_log = []
    mock_harness.run = MagicMock(return_value=mock_result)

    mock_retriever = MagicMock()

    # build_harness is imported locally inside start_analysis via
    # "from main import build_harness", so we patch it at the main module level
    with patch("main.build_harness", return_value=(mock_harness, mock_retriever)):
        yield mock_harness, mock_retriever


# ── Analysis tests ───────────────────────────────────────────

def test_start_analysis(client, mock_build_harness):
    """POST /api/analyze returns analysisId and streamUrl."""
    mock_harness, _ = mock_build_harness

    # build_harness is imported locally inside start_analysis:
    #   "from main import build_harness"
    # So we patch it on the main module.
    resp = client.post("/api/analyze", json={"query": "Analyze NVDA"})

    assert resp.status_code == 200
    data = resp.json()
    assert "analysisId" in data
    assert "streamUrl" in data
    assert data["streamUrl"] == f"/api/analyze/{data['analysisId']}/stream"


# ── Memory tests ─────────────────────────────────────────────

def test_memory_list(client, tmp_memory):
    """GET /api/memory with test files returns correct structure."""
    (tmp_memory / "companies" / "NVDA.md").write_text("# NVDA", encoding="utf-8")
    (tmp_memory / "sectors" / "tech.md").write_text("# Tech", encoding="utf-8")
    (tmp_memory / "patterns" / "mean_reversion.md").write_text("# MR", encoding="utf-8")

    resp = client.get("/api/memory")
    assert resp.status_code == 200
    data = resp.json()
    assert "NVDA.md" in data["companies"]
    assert "tech.md" in data["sectors"]
    assert "mean_reversion.md" in data["patterns"]


def test_memory_read(client, tmp_memory):
    """GET /api/memory/companies/test.md returns file content."""
    (tmp_memory / "companies" / "test.md").write_text("# Test Company\nSome content", encoding="utf-8")

    resp = client.get("/api/memory/companies/test.md")
    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "# Test Company\nSome content"
    assert data["path"] == "companies/test.md"


def test_memory_write(client, tmp_memory):
    """PUT /api/memory/companies/test.md writes file content."""
    resp = client.put(
        "/api/memory/companies/test.md",
        json={"content": "# Updated Content"},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    # Verify the file was written
    path = tmp_memory / "companies" / "test.md"
    assert path.read_text(encoding="utf-8") == "# Updated Content"


def test_memory_read_nonexistent(client, tmp_memory):
    """GET nonexistent file returns 404."""
    resp = client.get("/api/memory/companies/nonexistent.md")
    assert resp.status_code == 404


def test_memory_delete(client, tmp_memory):
    """DELETE file removes it."""
    path = tmp_memory / "companies" / "to_delete.md"
    path.write_text("delete me", encoding="utf-8")

    resp = client.delete("/api/memory/companies/to_delete.md")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert not path.exists()


def test_memory_delete_nonexistent(client, tmp_memory):
    """DELETE nonexistent file returns 404."""
    resp = client.delete("/api/memory/companies/nonexistent.md")
    assert resp.status_code == 404


# ── Watchlist tests ──────────────────────────────────────────

def test_watchlist_empty(client, tmp_memory):
    """No company files returns empty list."""
    resp = client.get("/api/watchlist")
    assert resp.status_code == 200
    assert resp.json() == []


# ── SSE bridge tests ─────────────────────────────────────────

def test_sse_bridge_tool_start():
    """TOOL_START event maps to correct SSE format."""
    event = HarnessEvent(
        type=EventType.TOOL_START,
        data={"tool": "exa_search", "args": {"query": "NVDA revenue"}},
    )
    sse = harness_event_to_sse(event)
    assert sse is not None
    assert sse["event"] == "tool_start"
    assert sse["data"]["tool"] == "exa_search"
    assert sse["data"]["args"] == {"query": "NVDA revenue"}


def test_sse_bridge_tool_end():
    """TOOL_END with large result is truncated to 10KB."""
    large_result = "x" * 20_000  # >10KB
    event = HarnessEvent(
        type=EventType.TOOL_END,
        data={"tool": "web_fetch", "status": "ok", "result": large_result},
    )
    sse = harness_event_to_sse(event)
    assert sse is not None
    assert sse["event"] == "tool_end"
    assert sse["data"]["tool"] == "web_fetch"
    assert sse["data"]["status"] == "ok"
    # Result should be truncated
    result = sse["data"]["result"]
    assert len(result) <= 10 * 1024 + 50  # 10KB + truncation marker


def test_sse_bridge_text_delta():
    """TEXT_DELTA maps to correct format."""
    event = HarnessEvent(
        type=EventType.TEXT_DELTA,
        data={"content": "NVIDIA's revenue grew"},
    )
    sse = harness_event_to_sse(event)
    assert sse is not None
    assert sse["event"] == "text_delta"
    assert sse["data"]["content"] == "NVIDIA's revenue grew"


def test_sse_bridge_steering_injected():
    """STEERING_INJECTED maps to steering type."""
    event = HarnessEvent(
        type=EventType.STEERING_INJECTED,
        data={"message": "Focus on valuation"},
    )
    sse = harness_event_to_sse(event)
    assert sse is not None
    assert sse["event"] == "steering"
    assert sse["data"]["message"] == "Focus on valuation"


def test_sse_bridge_loop_detected():
    """LOOP_DETECTED maps to system type."""
    event = HarnessEvent(
        type=EventType.LOOP_DETECTED,
        data={"detectors": ["repeat", "ping_pong"], "message": "Loop detected"},
    )
    sse = harness_event_to_sse(event)
    assert sse is not None
    assert sse["event"] == "system"
    assert "Loop detected" in sse["data"]["message"]
    assert "repeat" in sse["data"]["message"]


def test_sse_bridge_skips_internal():
    """RUN_START and TURN_START return None (not sent to client)."""
    for event_type in (EventType.RUN_START, EventType.RUN_END, EventType.TURN_START, EventType.TURN_END):
        event = HarnessEvent(type=event_type, data={})
        sse = harness_event_to_sse(event)
        assert sse is None, f"{event_type} should be skipped but got {sse}"


# ── Knowledge URL ingest endpoint tests ──────────────────────

def test_upload_knowledge_url_ingested(client, monkeypatch):
    monkeypatch.setattr(
        "backend.api.ingest_url_document",
        lambda **kwargs: {
            "status": "ingested",
            "document": {"id": "kdoc_abc", "title": "Imported"},
        },
    )

    resp = client.post("/api/knowledge/upload-url", json={"url": "https://example.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "kdoc_abc"
    assert data["ingest_status"] == "ingested"


def test_import_knowledge_url_duplicate(client, monkeypatch):
    monkeypatch.setattr(
        "backend.api.ingest_url_document",
        lambda **kwargs: {
            "status": "duplicate",
            "duplicate_of": "kdoc_old",
            "document": {"id": "kdoc_old", "title": "Already Exists"},
        },
    )

    resp = client.post("/api/knowledge/import-url", json={"url": "https://example.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "duplicate"
    assert data["duplicate_of"] == "kdoc_old"
    assert data["document"]["id"] == "kdoc_old"


def test_import_knowledge_url_failed(client, monkeypatch):
    monkeypatch.setattr(
        "backend.api.ingest_url_document",
        lambda **kwargs: {
            "status": "failed",
            "error": "fetch_failed",
            "detail": "unable_to_extract_content",
        },
    )

    resp = client.post("/api/knowledge/import-url", json={"url": "https://example.com"})
    assert resp.status_code == 400
