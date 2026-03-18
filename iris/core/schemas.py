from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional, Tuple
from pydantic import BaseModel, Field


class Observation(BaseModel):
    id: str
    subject: str
    claim: str
    time: datetime
    source: str
    fact_or_view: Literal["fact", "view"]
    relevance: float = Field(ge=0.0, le=1.0)
    citation: str
    extracted_at: datetime
    extracted_by: str


class Driver(BaseModel):
    name: str
    description: str
    current_assessment: str
    evidence_count: int = 0


class KillCriterion(BaseModel):
    description: str
    resolved: bool = False
    resolution_evidence: Optional[str] = None


class EvidenceCard(BaseModel):
    id: str
    observation_id: str
    hypothesis_id: str
    direction: Literal["supports", "refutes", "mixed", "neutral"]
    reliability: float = Field(ge=0.0, le=1.0)
    independence: float = Field(ge=0.0, le=1.0)
    novelty: float = Field(ge=0.0, le=1.0)
    driver_link: str
    reasoning: str
    created_at: datetime


class Hypothesis(BaseModel):
    id: str
    thesis: str
    company: str
    timeframe: str
    drivers: list[Driver] = Field(min_length=3, max_length=6)
    kill_criteria: list[KillCriterion]
    confidence: float = Field(ge=0.0, le=100.0)
    evidence_log: list[EvidenceCard] = Field(default_factory=list)
    created_at: datetime
    last_updated: datetime


class Assumption(BaseModel):
    name: str
    value: str
    reasoning: str
    source: str


class ValuationOutput(BaseModel):
    methodology: str
    methodology_reasoning: str
    fair_value_range: Tuple[float, float]
    current_price: float
    valuation_gap: float
    key_assumptions: list[Assumption] = Field(default_factory=list)
    bull_case: dict
    bear_case: dict
    skill_used: Optional[str] = None


class TradeScore(BaseModel):
    id: str
    hypothesis_id: str
    valuation_id: Optional[str]
    raw_score: float = Field(ge=0.0, le=100.0)
    constrained_score: float = Field(ge=0.0, le=100.0)
    constraint_reasons: list[str] = Field(default_factory=list)
    recommendation: Literal[
        "WATCH", "RESEARCH_MORE", "CANDIDATE", "INITIATE_SMALL", "HIGH_CONVICTION"
    ]
    fundamental_quality: float = Field(ge=0.0, le=1.0)
    catalyst_timing: float = Field(ge=0.0, le=1.0)
    risk_penalty: float = Field(ge=0.0, le=1.0)
    reasoning: str
    created_at: datetime


class Position(BaseModel):
    """Paper portfolio position."""
    ticker: str
    shares: float
    avg_cost: float
    entry_date: datetime
    hypothesis_id: str
    sector: str = ""
    target_weight: float = 0.0


class TradeSignal(BaseModel):
    """Output of generate_trade_signal."""
    id: str
    ticker: str
    action: Literal["BUY", "SELL", "TRIM", "HOLD", "WATCH", "NO_ENTRY"]
    target_weight: float = Field(ge=0.0, le=1.0)
    conviction: Optional[str] = None
    discount_pct: Optional[float] = None
    signal_strength: Literal["MANDATORY", "STRONG", "MODERATE", "WEAK", "NEUTRAL", "BLOCKED"]
    reasoning: str
    constraint_checks: list[str] = Field(default_factory=list)
    created_at: datetime


class AssumptionError(BaseModel):
    """Single assumption prediction vs actual comparison."""
    metric: str
    predicted: float
    actual: float
    error: float
    abs_error: float
    direction: Literal["overestimate", "underestimate"]


class Attribution(BaseModel):
    """P&L attribution record — feeds the experience library."""
    id: str
    ticker: str
    hypothesis_id: str
    attribution_date: datetime
    assumption_errors: list[AssumptionError] = Field(default_factory=list)
    largest_error_source: Optional[str] = None
    stock_return_pct: float
    benchmark_return_pct: float
    alpha_vs_benchmark_pct: float
    alpha_vs_sector_pct: Optional[float] = None
    sizing_assessment: Optional[Literal[
        "undersized_winner", "oversized_loser",
        "well_sized_winner", "well_sized_loser", "neutral"
    ]] = None
    experience_entries: list[dict] = Field(default_factory=list)


class AuditTrail(BaseModel):
    id: str
    company: str
    documents_used: list[str]
    observations_extracted: int
    evidence_supporting: list[str]
    evidence_refuting: list[str]
    belief_trajectory: list[dict]
    valuation_method: str
    key_assumptions: list[str]
    raw_trade_score: float
    constrained_trade_score: float
    constraint_reasons: list[str]
    final_recommendation: str
    soul_deviations: list[str] = Field(default_factory=list)
    model_used: str
    timestamp: datetime
    total_llm_calls: int
    total_cost_usd: float = 0.0
