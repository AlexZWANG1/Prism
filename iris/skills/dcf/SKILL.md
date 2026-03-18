# DCF Valuation Skill

## When to use

Use the DCF (Discounted Cash Flow) skill when the target company has **predictable, modelable cash flows**. Good candidates include:

- Mature companies with stable or steadily growing revenue
- Companies with recurring revenue models (SaaS, subscriptions)
- Businesses where segment-level revenue drivers are identifiable

Avoid DCF as the primary method for pre-revenue companies, highly cyclical businesses without clear cycle positioning, or companies undergoing radical transformation where historical patterns offer no guidance.

## How to build assumptions

1. **Start with segments.** Break revenue into business segments with individual growth trajectories. Each segment needs a current annual revenue base and per-year growth rate assumptions with reasoning.
2. **Margin structure.** Set gross margin, opex ratio, capex ratio, and working capital change. Use historical averages as anchors, then adjust for thesis-specific views (e.g., margin expansion from scale).
3. **Discount rate.** WACC should reflect the company's risk profile. Start with CAPM-derived WACC from public data, then sanity-check against peers.
4. **Terminal value.** Terminal growth rate must be below WACC and should not exceed long-run nominal GDP growth (~3-4%).
5. **Scenarios.** For contentious assumptions, define bull/bear scenarios with probability weights.

## Multi-round workflow

- **Round 1:** Build the base-case DCF with your best-estimate assumptions. Review the implied multiples (Fwd P/E, EV/EBITDA, FCF yield, PEG) for sanity.
- **Comps cross-check (required after Round 1):** Run `get_comps` to compare your DCF-implied multiples against actual peer multiples. If your implied Fwd P/E is 2x the peer median, your assumptions likely need revision.
- **Round 2+:** Revise assumptions based on comps feedback, scenario analysis, or new information. The revision history tracks how your fair value estimate evolves across rounds.

Multiple rounds are expected. A single-pass DCF without comps validation is incomplete.
