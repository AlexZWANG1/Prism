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
                type="observation",
                subject="NVDA",
                content="DC revenue up 78%",
                confidence=0.9,
            )
        item = retriever.get_knowledge_item(item_id)
        assert item is not None
        assert item["type"] == "observation"
        assert item["subject"] == "NVDA"
        assert item["content"] == "DC revenue up 78%"

    def test_query_by_type_and_subject(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            retriever.save_knowledge_item(type="observation", subject="NVDA", content="Obs 1")
            retriever.save_knowledge_item(type="experience", subject="NVDA", content="Exp 1")
            retriever.save_knowledge_item(type="observation", subject="AMD", content="Obs 2")

        nvda_obs = retriever.query_knowledge_items(type="observation", subject="NVDA")
        assert len(nvda_obs) == 1
        assert nvda_obs[0]["content"] == "Obs 1"

        all_nvda = retriever.query_knowledge_items(subject="NVDA")
        assert len(all_nvda) == 2

    def test_update_structured_data(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            item_id = retriever.save_knowledge_item(
                type="experience", subject="NVDA", content="Test",
                structured_data={"times_retrieved": 0, "status": "active"},
            )
        retriever.update_knowledge_item_structured_data(item_id, {"times_retrieved": 5})
        item = retriever.get_knowledge_item(item_id)
        assert item["structured_data"]["times_retrieved"] == 5
        assert item["structured_data"]["status"] == "active"  # preserved


# ── Section 2: remember tool ──────────────────────────────────

class TestRemember:
    def test_remember_observation(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            result = remember(
                retriever=retriever,
                type="observation",
                subject="NVDA",
                content="DC revenue up 78%",
                confidence=0.95,
                source="Q4 earnings",
            )
        assert result.status == "ok"
        assert "id" in result.data

        # Verify stored in knowledge_items
        items = retriever.query_knowledge_items(type="observation", subject="NVDA")
        assert len(items) == 1
        assert "78%" in items[0]["content"]

    def test_remember_experience_novel(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            result = remember(
                retriever=retriever,
                type="experience",
                subject="NVDA",
                content="Always check management guidance accuracy",
                zone="warning",
                level="pattern",
                confidence=0.7,
            )
        assert result.status == "ok"
        assert result.data["action"] == "inserted"

    def test_remember_experience_strategic_blocked(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            result = remember(
                retriever=retriever,
                type="experience",
                subject="NVDA",
                content="Semiconductor guidance is always conservative",
                level="strategic",
                confidence=0.8,
            )
        assert result.status == "ok"
        assert result.data["status"] == "pending_confirmation"

    def test_remember_note_exports_markdown(self, retriever, tmp_path):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            with patch("tools.unified_memory.config_get", return_value=str(tmp_path / "memory")):
                result = remember(
                    retriever=retriever,
                    type="note",
                    subject="NVDA",
                    content="# NVDA Analysis\nStrong buy.",
                    note_category="company",
                )
        assert result.status == "ok"
        # Check markdown file was created
        md_path = tmp_path / "memory" / "companies" / "NVDA.md"
        assert md_path.exists()
        assert "Strong buy" in md_path.read_text(encoding="utf-8")

    def test_remember_prediction(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            result = remember(
                retriever=retriever,
                type="prediction",
                subject="NVDA",
                content="Fair value prediction: $180/share",
                metric="fair_value",
                predicted=180.0,
            )
        assert result.status == "ok"
        assert "review_after" in result.data

        items = retriever.query_knowledge_items(type="prediction", subject="NVDA")
        assert len(items) == 1
        sd = items[0]["structured_data"]
        assert sd["predicted"] == 180.0
        assert sd["actual"] is None

    def test_mark_useful_via_source(self, retriever):
        """remember(source="existing_id") increments useful count on that item."""
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            # Save an experience first
            result = remember(
                retriever=retriever,
                type="experience",
                subject="NVDA",
                content="Check GPU supply chain",
                zone="golden",
                level="factual",
                confidence=0.7,
            )
            exp_id = result.data["id"]

            # Save another item referencing the first
            remember(
                retriever=retriever,
                type="observation",
                subject="NVDA",
                content="Supply chain confirmed strong",
                source=exp_id,
            )

        item = retriever.get_knowledge_item(exp_id)
        assert item["structured_data"]["times_useful"] == 1


# ── Section 3: recall tool ───────────────────────────────────

class TestRecall:
    def test_recall_returns_grouped(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            remember(retriever=retriever, type="observation", subject="NVDA", content="Revenue up")
            remember(retriever=retriever, type="note", subject="NVDA", content="Analysis note")
            remember(retriever=retriever, type="experience", subject="NVDA",
                     content="Lesson learned", zone="warning", level="factual", confidence=0.7)

            result = recall(retriever=retriever, context="NVDA analysis", subject="NVDA")

        assert result.status == "ok"
        data = result.data
        assert len(data["observations"]) >= 1
        assert len(data["notes"]) >= 1
        assert len(data["experiences"]["warnings"]) >= 1
        assert data["total_results"] >= 3

    def test_recall_experience_warnings_flagged(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            remember(retriever=retriever, type="experience", subject="NVDA",
                     content="Overestimated growth", zone="warning", level="factual", confidence=0.7)

            result = recall(retriever=retriever, context="DCF assumptions", subject="NVDA")

        assert "Warning Zone" in result.data["instruction"]

    def test_recall_type_filter(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            remember(retriever=retriever, type="observation", subject="NVDA", content="Obs")
            remember(retriever=retriever, type="note", subject="NVDA", content="Note")

            result = recall(
                retriever=retriever, context="test", subject="NVDA",
                types=["observation"],
            )

        assert result.status == "ok"
        assert len(result.data["observations"]) >= 1
        assert len(result.data["notes"]) == 0

    def test_recall_empty_db(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            result = recall(retriever=retriever, context="anything")

        assert result.status == "ok"
        assert result.data["total_results"] == 0


# ── Section 6: auto-inject ───────────────────────────────────

class TestAutoInject:
    def test_auto_recall_for_context(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            remember(retriever=retriever, type="observation", subject="NVDA", content="DC revenue up")
            remember(retriever=retriever, type="experience", subject="NVDA",
                     content="Watch margins", zone="warning", level="factual", confidence=0.7)

            result = auto_recall_for_context(retriever, "NVDA")

        assert result is not None
        assert len(result["observations"]) >= 1
        assert len(result["experiences"]["warnings"]) >= 1

    def test_auto_recall_empty(self, retriever):
        result = auto_recall_for_context(retriever, "NVDA")
        assert result is None

    def test_pending_prediction_detection(self, retriever):
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            # Save a prediction with review_after in the past
            past_date = (date.today() - timedelta(days=10)).isoformat()
            retriever.save_knowledge_item(
                type="prediction", subject="NVDA",
                content="Fair value $180",
                structured_data={
                    "metric": "fair_value", "predicted": 180.0,
                    "actual": None, "review_after": past_date,
                },
            )

            result = auto_recall_for_context(retriever, "NVDA")

        assert result is not None
        assert len(result["pending_predictions"]) == 1
        assert result["pending_predictions"][0]["predicted"] == 180.0


# ── Section 9: migration ─────────────────────────────────────

class TestMigration:
    def test_migration_idempotent(self, retriever):
        """save_knowledge_item with same ID is idempotent (INSERT OR REPLACE)."""
        with patch.object(retriever, "_embed", side_effect=_mock_embed):
            retriever.save_knowledge_item(
                item_id="exp_w_test1",
                type="experience",
                subject="NVDA",
                content="Test experience",
                structured_data={"zone": "warning", "status": "active"},
                tags=["migrated"],
            )

            item = retriever.get_knowledge_item("exp_w_test1")
            assert item is not None
            assert item["content"] == "Test experience"

            # Save same ID again — should replace, not duplicate
            retriever.save_knowledge_item(
                item_id="exp_w_test1",
                type="experience",
                subject="NVDA",
                content="Test experience updated",
                tags=["migrated"],
            )

            items = retriever.query_knowledge_items(type="experience", subject="NVDA")
            assert len(items) == 1  # not duplicated
            assert items[0]["content"] == "Test experience updated"
