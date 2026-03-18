"""Tests for hypothesis skill tools (migrated from tools/knowledge.py)."""

from datetime import datetime
from skills.hypothesis.tools import (
    extract_observation, create_hypothesis, add_evidence_card, query_knowledge
)
from tools.retrieval import SQLiteRetriever


def make_retriever(tmp_path):
    return SQLiteRetriever(str(tmp_path / "test.db"))


def test_extract_observation_saves_to_db(tmp_path):
    r = make_retriever(tmp_path)
    result = extract_observation(
        retriever=r, subject="NVDA",
        claim="Data center revenue up 78% YoY",
        source="NVDA Q4 2026 Earnings Call",
        fact_or_view="fact", relevance=0.95,
        citation="Data Center revenue was $XX billion...",
        time_str="2026-02-21", extracted_by="gpt-4o",
    )
    assert result.status == "ok"
    obs_id = result.data["id"]
    observations = r.query_observations(subject="NVDA")
    assert len(observations) == 1
    assert observations[0].id == obs_id


def test_create_hypothesis_saves_and_returns(tmp_path):
    r = make_retriever(tmp_path)
    result = create_hypothesis(
        retriever=r, company="NVDA",
        thesis="NVDA will dominate AI training infrastructure for 3+ years",
        timeframe="36 months",
        drivers=[
            {"name": "CUDA moat", "description": "10yr software ecosystem", "current_assessment": "very strong"},
            {"name": "Data center demand", "description": "Hyperscaler capex cycle", "current_assessment": "accelerating"},
            {"name": "Supply chain", "description": "TSMC partnership", "current_assessment": "stable"},
        ],
        kill_criteria=[
            {"description": "AMD ROCm achieves CUDA parity"},
            {"description": "Hyperscaler capex cuts > 30% YoY"},
        ],
        initial_confidence=50.0,
    )
    assert result.status == "ok"
    hyp = r.get_hypothesis(result.data["id"])
    assert hyp.company == "NVDA"
    assert len(hyp.drivers) == 3


def test_add_evidence_card_updates_confidence(tmp_path):
    r = make_retriever(tmp_path)
    obs_result = extract_observation(
        retriever=r, subject="NVDA", claim="Jensen raised capex guidance 18%",
        source="Earnings call", fact_or_view="fact", relevance=0.9,
        citation="We are raising...", time_str="2026-02-21", extracted_by="gpt-4o"
    )
    hyp_result = create_hypothesis(
        retriever=r, company="NVDA", thesis="NVDA AI dominance", timeframe="24 months",
        drivers=[
            {"name": "d1", "description": "x", "current_assessment": "ok"},
            {"name": "d2", "description": "y", "current_assessment": "ok"},
            {"name": "d3", "description": "z", "current_assessment": "ok"},
        ],
        kill_criteria=[{"description": "AMD parity"}],
        initial_confidence=50.0,
    )
    result = add_evidence_card(
        retriever=r,
        hypothesis_id=hyp_result.data["id"],
        observation_id=obs_result.data["id"],
        direction="supports", reliability=0.9,
        independence=0.8, novelty=0.7,
        driver_link="d1",
        reasoning="Capex guidance raise directly supports data center demand driver",
    )
    assert result.status == "ok"
    updated_hyp = r.get_hypothesis(hyp_result.data["id"])
    assert updated_hyp.confidence > 50.0
    assert len(updated_hyp.evidence_log) == 1


def test_create_hypothesis_validates_drivers(tmp_path):
    r = make_retriever(tmp_path)
    result = create_hypothesis(
        retriever=r, company="NVDA", thesis="Test", timeframe="12m",
        drivers=[
            {"name": "d1", "description": "x", "current_assessment": "ok"},
        ],
        kill_criteria=[{"description": "kill"}],
        initial_confidence=50.0,
    )
    assert result.status == "error"
    assert "3 drivers" in result.error


def test_create_hypothesis_validates_confidence(tmp_path):
    r = make_retriever(tmp_path)
    result = create_hypothesis(
        retriever=r, company="NVDA", thesis="Test", timeframe="12m",
        drivers=[
            {"name": "d1", "description": "x", "current_assessment": "ok"},
            {"name": "d2", "description": "y", "current_assessment": "ok"},
            {"name": "d3", "description": "z", "current_assessment": "ok"},
        ],
        kill_criteria=[{"description": "kill"}],
        initial_confidence=150.0,
    )
    assert result.status == "error"
    assert "range" in result.error


def test_extract_observation_validates_citation(tmp_path):
    r = make_retriever(tmp_path)
    result = extract_observation(
        retriever=r, subject="NVDA", claim="Test",
        source="Test", fact_or_view="fact", relevance=0.5,
        citation="  ", time_str="2026-01-01",
    )
    assert result.status == "error"
    assert "citation" in result.error


def test_query_knowledge_returns_both(tmp_path):
    r = make_retriever(tmp_path)
    extract_observation(
        retriever=r, subject="NVDA", claim="Revenue up",
        source="Earnings", fact_or_view="fact", relevance=0.9,
        citation="Revenue was...", time_str="2026-02-21",
    )
    create_hypothesis(
        retriever=r, company="NVDA", thesis="NVDA dominance", timeframe="24m",
        drivers=[
            {"name": "d1", "description": "x", "current_assessment": "ok"},
            {"name": "d2", "description": "y", "current_assessment": "ok"},
            {"name": "d3", "description": "z", "current_assessment": "ok"},
        ],
        kill_criteria=[{"description": "kill"}],
        initial_confidence=50.0,
    )
    result = query_knowledge(retriever=r, subject="NVDA", object_type="both")
    assert result.status == "ok"
    assert len(result.data["observations"]) == 1
    assert len(result.data["hypotheses"]) == 1
