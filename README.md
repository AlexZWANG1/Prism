# Prism — AI-Powered Equity Research Intelligence

<p align="center">
  <img src="docs/screenshots/home-watchlist.png" alt="Prism Home" width="800" />
</p>

> **Decompose complexity. See clearly.**
>
> A beam of market data goes in — Prism decomposes it into a clear spectrum: fundamental thesis, valuation models, and trading signals.

---

## What is Prism?

Prism is an **autonomous equity research agent** that turns a natural-language research task into a structured, evidence-backed investment analysis. It combines an LLM harness (agent loop), domain-specific skills, and a rich tool suite to replicate the workflow of a professional equity analyst — from fundamental deep-dives to DCF models to trade signal generation.

### Key Capabilities

| Capability | Description |
|---|---|
| **Fundamental Research** | Hypothesis-driven analysis with Bayesian evidence chains. Searches news, SEC filings, earnings transcripts, and your own knowledge base. |
| **Valuation** | DCF models, comparable company analysis, fair-value estimates with scenario sensitivity. |
| **Trading Signals** | Translates research conclusions into actionable trade signals with position sizing and portfolio tracking. |
| **Knowledge Base** | Upload PDFs, articles, URLs — Prism chunks, embeds, and retrieves them during analysis via vector search. |
| **Memory System** | Persistent per-company and per-sector notes that accumulate across sessions, enabling long-term research continuity. |
| **Calibration** | Tracks past predictions against outcomes for self-improvement. |

---

## Screenshots

### Home — Research Input & Skill Overview
<p align="center"><img src="docs/screenshots/home-watchlist.png" alt="Home Page" width="750" /></p>

### Knowledge Base — Upload & Manage Research Materials
<p align="center"><img src="docs/screenshots/knowledge.png" alt="Knowledge Base" width="750" /></p>

### Memory Management — Company & Sector Notes
<p align="center"><img src="docs/screenshots/memory.png" alt="Memory Manager" width="750" /></p>

### Dev Panel — System Architecture Inspector
<p align="center"><img src="docs/screenshots/dev-panel.png" alt="Dev Panel" width="750" /></p>

---

## Architecture

```
Frontend (Next.js)
├── Home / Analysis / Knowledge / Memory / Dev
│
│── SSE (streaming) + REST APIs
│
Backend (FastAPI + Uvicorn)
├── Harness (Agent Loop)
│   ├── Budget control, loop detection, context compaction
│   └── LLM Client → cliproxy → gpt-5.4
├── Skills
│   ├── Fundamentals — deep research methodology
│   ├── Valuation — DCF + comps framework
│   ├── Trading — signal generation + execution
│   └── Hypothesis — Bayesian evidence evaluation
├── Tools (15+)
│   ├── Market: quote, history, financials, macro
│   ├── Research: exa_search, web_fetch, sec_filing, transcript
│   ├── Knowledge: search_knowledge, url_ingest, chunker, embedder
│   └── Memory: remember, recall, unified_memory
├── Soul (Prompt Layer)
│   ├── role, reflection, self_check, steering
│   └── Bayesian evidence evaluation framework
└── SQLite (iris.db)
    └── analysis_runs, knowledge_documents, memory
```

---

## Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- API keys: OpenAI-compatible LLM endpoint, [EXA](https://exa.ai) for web search, [FMP](https://financialmodelingprep.com) for financial data

### 1. Clone & Install

```bash
git clone https://github.com/AlexZWANG1/touzibishi.git
cd touzibishi

# Backend
pip install -r requirements.txt

# Frontend
cd iris-frontend
npm install
```

### 2. Configure

Create `iris-frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Edit `iris/iris_config.yaml` to tune harness parameters (tool rounds, budget, timeouts).

Set your API keys as environment variables or in your proxy configuration.

### 3. Run

```bash
# Terminal 1 — Backend
cd iris
python -m uvicorn backend.api:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd iris-frontend
npm run dev
```

Open **http://localhost:3000** and start researching.

---

## Core Skills

### Fundamentals (`iris/skills/fundamentals/`)
Deep research methodology: form hypotheses, gather multi-source evidence (SEC filings, earnings calls, news), evaluate with Bayesian reasoning, and produce structured thesis reports.

### Valuation (`iris/skills/valuation/`)
Build DCF models and comparable company analyses. Pulls financial data automatically, calculates fair value ranges with bull/base/bear scenarios.

### Trading (`iris/skills/trading/`)
Converts research conclusions into trade signals. Supports signal generation with conviction levels, position sizing, simulated trade execution, and portfolio tracking.

### Hypothesis (`iris/skills/hypothesis/`)
Bayesian evidence chain management. Create hypotheses, attach evidence cards with support/refute weights, and track evolving conviction over time.

---

## Tool Suite (15+ Tools)

| Category | Tools | Description |
|---|---|---|
| **Market Data** | `quote`, `history`, `financials`, `macro` | Real-time quotes, historical prices, financial statements, macro indicators |
| **Research** | `exa_search`, `web_fetch` | Web search and page content extraction |
| **SEC Filings** | `sec_filing`, `transcript` | 10-K/10-Q filings, earnings call transcripts |
| **Valuation** | `valuation` | DCF, comps, and fair-value calculations |
| **Knowledge** | `search_knowledge`, `url_ingest` | Vector search over uploaded documents |
| **Memory** | `remember`, `recall` | Persistent cross-session memory |
| **Trading** | `generate_trade_signal`, `execute_trade`, `get_portfolio` | Signal generation, trade execution, portfolio view |

---

## Extending Prism

### Adding a New Tool

1. Create a new file in `iris/tools/` (e.g., `my_tool.py`)
2. Define a function with type hints and a docstring — the harness auto-discovers tools
3. Register in `iris_config.yaml` under `always_exposed_tools` and optionally `tool_triggers`

### Adding a New Skill

1. Create a directory under `iris/skills/` (e.g., `iris/skills/my_skill/`)
2. Add `SKILL.md` — the skill prompt that guides the agent's behavior
3. Add `tools.py` — skill-specific tool functions
4. Register in `iris_config.yaml` under the relevant mode's `skills` list

### Customizing the Soul

Edit files in `iris/soul/` to change the agent's reasoning style, risk philosophy, or self-check criteria. The soul layer is pure prompt — no code changes needed.

### Configuration

All behavioral parameters live in `iris/iris_config.yaml`:
- **Harness**: tool rounds, timeouts, budget limits
- **Modes**: different configurations for `analysis` vs `learning` mode
- **Vector search**: embedding model, top-k retrieval
- **Knowledge**: chunk size and overlap for document ingestion
- **Loop detection**: thresholds for repetitive behavior detection

---

## Pricing & Cost

Prism is **open-source and free to self-host**. Your costs come from the underlying APIs:

| Service | Purpose | Typical Cost |
|---|---|---|
| LLM API (OpenAI / compatible) | Core reasoning engine | ~$0.05–0.50 per analysis |
| EXA Search API | Web search for research | Free tier available |
| FMP API | Financial data & statements | Free tier available |

A typical deep analysis (25 tool rounds) costs roughly **$0.10–0.30** in LLM API calls.

---

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Python, FastAPI, Uvicorn
- **Database**: SQLite
- **Embeddings**: OpenAI `text-embedding-3-small`
- **LLM**: Any OpenAI-compatible API (GPT-4o, GPT-5.4, etc.)

---

## License

MIT

---

<p align="center">
  <sub>Built with care for independent equity research.</sub>
</p>
