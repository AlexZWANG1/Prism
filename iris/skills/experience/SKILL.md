# Experience Library — Self-Learning System

## What this is

The experience library is your long-term memory of what worked, what failed, and why.
It is inspired by FLEX (Forward Learning from Experience): your "weights" don't change,
but your reference library continuously improves. You get smarter not by changing who
you are, but by accumulating better judgment.

## When to use

### Recall (before every analysis)
Before making predictions or assumptions about a company, **always** call
`recall_experiences` to check if you have relevant past lessons. This is non-negotiable.
If Warning Zone entries come back, you MUST explicitly address them in your reasoning.

### Save (after attribution or significant insight)
After `run_attribution` produces experience suggestions, call `save_experience`
to persist them. Also save experiences when you discover notable patterns during
research — not everything needs to wait for attribution.

### Reflect (after earnings or major events)
When actual results arrive, call `run_reflection` to systematically compare your
predictions against reality. This generates structured attribution and experience
entries in one step.

### Distill (periodically, after 5+ attributions)
Call `distill_patterns` when enough single-company experiences have accumulated.
This looks across companies for sector-level or strategic-level patterns.

## Architecture: Dual Zone + Three Levels

```
Experience Library
├── Golden Zone (what worked)
│   ├── Strategic — broad principles ("semiconductor guidance is conservative")
│   ├── Pattern — repeatable methods ("track TSMC revenue as leading indicator")
│   └── Factual — specific validated facts ("NVDA GM expands with mix shift to DC")
│
└── Warning Zone (what failed)
    ├── Strategic — systemic biases ("we overestimate moat durability")
    ├── Pattern — recurring mistakes ("always underestimate supply expansion")
    └── Factual — specific errors ("predicted 35% growth, actual was 42%")
```

## Three-way update rule (FLEX style)

When a new experience arrives, don't blindly append. Follow this:

1. **Duplicate** (semantic similarity > 0.90) → Discard new entry, increment
   evidence count on existing entry, update `last_validated`.
2. **Similar** (similarity 0.70-0.90) → Merge: keep the richer entry, incorporate
   new evidence or detail from the other.
3. **Novel** (similarity < 0.70) → Insert as new entry at appropriate level.

This keeps the library compact and high-quality.

## What you learn from vs. what you don't

### Learn from (factual verification):
- Revenue growth: predicted vs actual quarterly results
- Margin: predicted vs actual
- CapEx, tax rate, working capital: predicted vs actual
- Management guidance accuracy: what they said vs what happened
- Catalyst timing: predicted date vs actual date

### Learn from (soft verification):
- Competitive dynamics: did the moat hold?
- Management quality assessment: did they execute?
- Sector trends: did the macro thesis play out?

### DO NOT learn from:
- Stock price movements → market can be irrational
- Valuation multiples → "market gave it 35x" is not a lesson
- Short-term price reactions to earnings → noise

**Core principle: Learn from facts, not from prices.**

## Boundaries — what AI can and cannot modify

| Layer | AI autonomous | Needs human confirmation | Never touch |
|-------|--------------|------------------------|-------------|
| Factual experiences | ✓ Add/merge/expire | | |
| Pattern experiences | ✓ Add/merge/expire | | |
| Strategic experiences | | ✓ Propose + reasoning | |
| Calibration bias records | ✓ Update statistics | ✓ Apply auto-correction | |
| Soul / philosophy | | | ✗ Immutable |
| DCF formulas | | | ✗ Immutable |
| Harness parameters | | | ✗ Immutable |
