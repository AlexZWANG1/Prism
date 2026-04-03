"""Tests for the unified memory system (remember + recall)."""

import json
from datetime import date, timedelta
from unittest.mock import patch

import pytest

from tools.retrieval import SQLiteRetriever
from tools.unified_memory import remember, recall, auto_recall_for_context


def _mock_embed(texts):
    """Deterministic fake embeddings for testing."""
    results = []
    for t in texts:
        h = hash(t) % 1000
        results.append([h / 1000, (h * 7 % 1000) / 1000, (h * 13 % 1000) / 1000])
    return results


@pytest.fixture
def retriever(tmp_path):
    r = SQLiteRetriever(str(tmp_path / "test.db"))
    return r


# ── Section 1: knowledge_items table ──────────────────────────

class TestKnowledgeItemsTable:
    def test_table_created(self, retriever):
        import sqlite3
        with sqlite3.connect(retriever.db_path) as conn:
            tables = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_items'"
            ).fetchall()
        assert len(tables) == 1

    def test_save_and_get(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            item_id = retriever.save_knowledge_item(
                type="note",
                subject="NVDA",
                content="DC revenue up 78%",
                confidence=0.9,
            )
        item = retriever.get_knowledge_item(item_id)
        assert item is not None
        assert item["subject"] == "NVDA"
        assert item["content"] == "DC revenue up 78%"

    def test_query_by_type_and_subject(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            retriever.save_knowledge_item(type="note", subject="NVDA", content="Note 1")
            retriever.save_knowledge_item(type="note", subject="AMD", content="Note 2")

        nvda = retriever.query_knowledge_items(subject="NVDA")
        assert len(nvda) == 1
        assert nvda[0]["content"] == "Note 1"

    def test_update_structured_data(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            item_id = retriever.save_knowledge_item(
                type="note", subject="NVDA", content="Test",
                structured_data={"times_retrieved": 0, "status": "active"},
            )
        retriever.update_knowledge_item_structured_data(item_id, {"times_retrieved": 5})
        item = retriever.get_knowledge_item(item_id)
        assert item["structured_data"]["times_retrieved"] == 5
        assert item["structured_data"]["status"] == "active"  # preserved


# ── Section 2: remember tool ──────────────────────────────────

class TestRemember:
    def test_remember_saves_note(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            result = remember(
                retriever=retriever,
                subject="NVDA",
                content="NVDA FY2026 Data Center revenue hit $193.7B. This exceeded expectations due to hyperscaler capex intensity.",
                confidence=0.9,
                source="Q4 earnings",
                tags=["earnings", "data-center"],
            )
        assert result.status == "ok"
        assert result.data["action"] == "saved"
        assert "id" in result.data

        items = retriever.query_knowledge_items(subject="NVDA")
        assert len(items) == 1
        assert "193.7B" in items[0]["content"]

    def test_remember_rejects_short_content(self, retriever):
        result = remember(
            retriever=retriever,
            subject="NVDA",
            content="DC revenue up",
        )
        assert result.status == "error"
        assert "太短" in result.error

    def test_remember_legacy_params_accepted(self, retriever):
        """Old callers passing type/zone/level should still work."""
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            result = remember(
                retriever=retriever,
                type="experience",  # legacy param, ignored
                subject="NVDA",
                content="Always check management guidance accuracy for semiconductor companies in AI capex cycles.",
                zone="warning",  # legacy param, ignored
                level="pattern",  # legacy param, ignored
                confidence=0.7,
            )
        assert result.status == "ok"
        assert result.data["action"] == "saved"

    def test_mark_useful_via_source(self, retriever):
        """remember(source="existing_id") increments useful count on that item."""
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            # Save a note first
            item_id = retriever.save_knowledge_item(
                type="note", subject="NVDA",
                content="GPU supply chain analysis",
                structured_data={"times_useful": 0},
            )

            # Save another note referencing the first
            remember(
                retriever=retriever,
                subject="NVDA",
                content="Supply chain confirmed strong based on prior analysis. Channel checks and quarterly data support continued strength.",
                source=item_id,
            )

        item = retriever.get_knowledge_item(item_id)
        assert item["structured_data"]["times_useful"] == 1


# ── Section 3: recall tool ───────────────────────────────────

class TestRecall:
    def test_recall_returns_flat_list(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            retriever.save_knowledge_item(type="note", subject="NVDA", content="Note 1")
            retriever.save_knowledge_item(type="note", subject="NVDA", content="Note 2")

            result = recall(retriever=retriever, context="NVDA analysis", subject="NVDA")

        assert result.status == "ok"
        assert result.data["total"] >= 2
        assert isinstance(result.data["notes"], list)

    def test_recall_empty_db(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            result = recall(retriever=retriever, context="anything")

        assert result.status == "ok"
        assert result.data["total"] == 0

    def test_recall_reads_legacy_types(self, retriever):
        """recall should still find old observation/experience/prediction entries."""
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            retriever.save_knowledge_item(type="observation", subject="NVDA", content="Legacy obs")
            retriever.save_knowledge_item(type="experience", subject="NVDA", content="Legacy exp")

            result = recall(retriever=retriever, context="test", subject="NVDA")

        assert result.status == "ok"
        assert result.data["total"] >= 2


# ── Section 4: auto-inject ───────────────────────────────────

class TestAutoInject:
    def test_auto_recall_for_context(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            retriever.save_knowledge_item(type="note", subject="NVDA", content="DC revenue up")
            retriever.save_knowledge_item(type="note", subject="NVDA", content="Watch margins")

            result = auto_recall_for_context(retriever, "NVDA")

        assert result is not None
        assert isinstance(result, list)
        assert len(result) >= 2

    def test_auto_recall_empty(self, retriever):
        result = auto_recall_for_context(retriever, "NVDA")
        assert result is None


# ── Section 5: migration ─────────────────────────────────────

class TestMigration:
    def test_migration_idempotent(self, retriever):
        """save_knowledge_item with same ID is idempotent (INSERT OR REPLACE)."""
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            retriever.save_knowledge_item(
                item_id="exp_w_test1",
                type="note",
                subject="NVDA",
                content="Test note",
                tags=["migrated"],
            )

            item = retriever.get_knowledge_item("exp_w_test1")
            assert item is not None
            assert item["content"] == "Test note"

            # Save same ID again — should replace, not duplicate
            retriever.save_knowledge_item(
                item_id="exp_w_test1",
                type="note",
                subject="NVDA",
                content="Test note updated",
                tags=["migrated"],
            )

            items = retriever.query_knowledge_items(subject="NVDA")
            assert len(items) == 1  # not duplicated
            assert items[0]["content"] == "Test note updated"
