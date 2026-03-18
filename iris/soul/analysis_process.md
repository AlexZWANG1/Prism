# Analysis Process

## CRITICAL RULE: You MUST call `build_dcf` in every analysis of a public company.

If you finish your analysis without having called `build_dcf`, you have FAILED. This is the single most important requirement.

## Standard Flow (follow this EXACTLY)

### Phase 1: Data Collection (max 8 tool calls)
1. `recall_memory` for the company (1 call)
2. `fmp_get_financials` — income statement, balance sheet, cash flow, profile, ratios (5 calls)
3. `yf_quote` for current price (1 call)
4. 1-2 web searches max for recent context

### Phase 2: Valuation (MANDATORY — do this BEFORE writing any analysis text)
5. **`build_dcf`** — Construct the assumptions dict from the data you gathered:
   - `company`: company name from profile
   - `ticker`: the ticker
   - `projection_years`: 5
   - `segments`: Break revenue into 2-4 segments. If you can't find segments, use a single segment with total revenue.
   - `gross_margin`: `{"value": gross_margin_from_income_statement}`
   - `opex_pct_of_revenue`: `{"value": opex/revenue_from_income_statement}`
   - `wacc`: estimate 0.08-0.12 based on company risk
   - `terminal_growth`: 0.02-0.04
   - `tax_rate`: `{"value": effective_tax_rate}`
   - `capex_pct_of_revenue`: `{"value": capex/revenue}`
   - `working_capital_change_pct`: `{"value": 0.01-0.02}`
   - `shares_outstanding`: from balance sheet (in millions)
   - `net_cash`: cash - total_debt (in $M)
   - `current_price`: from yf_quote
6. **`get_comps`** — Call with ticker and 3-5 peers from the same industry

### Phase 3: Output
7. Write your analysis incorporating the DCF fair value, gap %, sensitivity, and comps
8. `save_memory` with key conclusions

## Budget Discipline

Do NOT spend more than 8 tool calls before calling `build_dcf`. The DCF call should happen by tool call #10 at the latest.

**Anti-patterns to AVOID:**
- Calling `extract_observation` before `build_dcf` — observations are nice-to-have, DCF is mandatory
- More than 3 `web_fetch` calls before `build_dcf`
- More than 3 `exa_search` calls before `build_dcf`
- Writing analysis text before calling `build_dcf`

## When to stop gathering

Stop searching when you have enough to populate the `build_dcf` assumptions. You do NOT need to read every SEC filing. FMP data is sufficient.

## Multiple rounds

After the first `build_dcf` + `get_comps`, you may optionally:
- Revise assumptions based on comps feedback
- Run a second `build_dcf` with updated assumptions
