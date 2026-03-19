# Learning Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `mode` parameter to the IRIS harness that isolates analysis and learning into separate tool/soul/skill configurations, enabling FLEX-style structured reflection.

**Architecture:** `build_harness(mode=)` constructs mode-specific Harness instances with different soul files, skills, tools, and budgets. Learning mode is driven by a new `reflection` skill. Experience schema gains a `methodology` field for procedural knowledge. Mode is passed to skill tools via `register_skill_config` so `save_experience` can enforce analysis-mode restrictions.

**Tech Stack:** Python/FastAPI backend, existing harness loop (unchanged), YAML config, JSON experience store.

**Spec:** `docs/superpowers/specs/2026-03-19-learning-mode-design.md`

---

## Chunk 1: Backend Infrastructure

### Task 1: Add `modes` config block to iris_config.yaml

**Files:**
- Modify: `iris/iris_config.yaml`

- [ ] **Step 1: Add modes config block**

Add this block at the end of `iris/iris_config.yaml`:

```yaml
# ── Mode-specific overrides ──
modes:
  analysis:
    soul_files: [role.md, process.md]
    skills: [hypothesis, dcf, trading, experience]
    tool_injection_mode: "dynamic"
    always_exposed_tools:
      - recall_memory
      - save_memory
      - save_experience
      - recall_experiences
      - memory_search
      - search_documents
      - build_dcf
      - get_comps
      - create_hypothesis
      - extract_observation
      - add_evidence_card
      - exa_search
      - web_fetch
      - fmp_get_financials
      - fred_get_macro
      - yf_quote
      - yf_history
      - upload_document
    max_tool_rounds: 25
    max_total_tool_calls: 60
    max_wall_time_seconds: 480

  learning:
    soul_files: [role.md, reflection.md]
    skills: [reflection, experience]
    tool_injection_mode: "all"
    always_exposed_tools:
      - recall_memory
      - save_memory
      - recall_experiences
      - save_experience
      - run_reflection
      - distill_patterns
      - fmp_get_financials
      - yf_quote
      - check_calibration
    max_tool_rounds: 40
    max_total_tool_calls: 120
    max_wall_time_seconds: 600
```

- [ ] **Step 2: Commit**

```bash
git add iris/iris_config.yaml
git commit -m "config: add modes block for analysis/learning mode separation"
```

---

### Task 2: Add `file_list` parameter to `load_soul()`

**Files:**
- Modify: `iris/core/config.py:65-71`
- Test: `iris/tests/test_config_mode.py` (create)

- [ ] **Step 1: Write the failing test**

Create `iris/tests/test_config_mode.py`:

```python
"""Tests for mode-aware config loading."""
import tempfile
from pathlib import Path

from core.config import load_soul


def test_load_soul_all_files():
    """Without file_list, load_soul returns all .md files."""
    with tempfile.TemporaryDirectory() as td:
        p = Path(td)
        (p / "a.md").write_text("# A", encoding="utf-8")
        (p / "b.md").write_text("# B", encoding="utf-8")
        result = load_soul(soul_dir=p)
        assert "# A" in result
        assert "# B" in result


def test_load_soul_filtered():
    """With file_list, only specified files are loaded."""
    with tempfile.TemporaryDirectory() as td:
        p = Path(td)
        (p / "a.md").write_text("# A", encoding="utf-8")
        (p / "b.md").write_text("# B", encoding="utf-8")
        (p / "c.md").write_text("# C", encoding="utf-8")
        result = load_soul(soul_dir=p, file_list=["a.md", "c.md"])
        assert "# A" in result
        assert "# C" in result
        assert "# B" not in result


def test_load_soul_missing_file_ignored():
    """file_list entries that don't exist on disk are silently skipped."""
    with tempfile.TemporaryDirectory() as td:
        p = Path(td)
        (p / "a.md").write_text("# A", encoding="utf-8")
        result = load_soul(soul_dir=p, file_list=["a.md", "nonexistent.md"])
        assert "# A" in result
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd iris && python -m pytest tests/test_config_mode.py -v`
Expected: FAIL — `load_soul() got an unexpected keyword argument 'file_list'`

- [ ] **Step 3: Implement load_soul file_list parameter**

In `iris/core/config.py`, replace the `load_soul` function (lines 65-71):

```python
def load_soul(soul_dir: Path = None, file_list: list[str] = None) -> str:
    """Load the Prompt layer from soul/*.md files.

    Args:
        soul_dir: Directory containing soul .md files.
        file_list: If provided, only load these filenames (in order).
                   If None, load all .md files (original behavior).
    """
    soul_dir = soul_dir or Path(__file__).parent.parent / "soul"
    if file_list is not None:
        files = [soul_dir / f for f in file_list if (soul_dir / f).exists()]
    else:
        files = sorted(soul_dir.glob("*.md"))
    parts = [f.read_text(encoding="utf-8") for f in files]
    return "\n\n---\n\n".join(parts) if parts else FALLBACK_SOUL
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd iris && python -m pytest tests/test_config_mode.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add iris/core/config.py iris/tests/test_config_mode.py
git commit -m "feat: load_soul accepts file_list for mode-selective loading"
```

---

### Task 3: Add `skill_names` filter to `load_skills()`

**Files:**
- Modify: `iris/core/skill_loader.py:24-27`
- Test: `iris/tests/test_config_mode.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `iris/tests/test_config_mode.py`:

```python
import yaml
from core.skill_loader import load_skills


def _create_skill(base: Path, name: str, tool_name: str):
    """Helper: create a minimal skill directory."""
    skill_dir = base / name
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(f"# {name} skill", encoding="utf-8")
    (skill_dir / "config.yaml").write_text(
        yaml.dump({"name": name}), encoding="utf-8"
    )
    (skill_dir / "tools.py").write_text(
        f"""
from tools.base import Tool, ToolResult, make_tool_schema

SCHEMA = make_tool_schema(
    name="{tool_name}",
    description="test tool",
    properties={{}},
    required=[],
)

def {tool_name}():
    return ToolResult.ok({{}})

def register(context):
    return [Tool({tool_name}, SCHEMA)]
""",
        encoding="utf-8",
    )


def test_load_skills_all():
    """Without skill_names, all skills are loaded."""
    with tempfile.TemporaryDirectory() as td:
        p = Path(td)
        _create_skill(p, "alpha", "tool_alpha")
        _create_skill(p, "beta", "tool_beta")
        tools, soul = load_skills(str(p))
        assert len(tools) == 2
        assert "alpha" in soul.lower()
        assert "beta" in soul.lower()


def test_load_skills_filtered():
    """With skill_names, only specified skills are loaded."""
    with tempfile.TemporaryDirectory() as td:
        p = Path(td)
        _create_skill(p, "alpha", "tool_alpha")
        _create_skill(p, "beta", "tool_beta")
        _create_skill(p, "gamma", "tool_gamma")
        tools, soul = load_skills(str(p), skill_names=["alpha", "gamma"])
        tool_names = [t.name for t in tools]
        assert "tool_alpha" in tool_names
        assert "tool_gamma" in tool_names
        assert "tool_beta" not in tool_names
        assert "beta" not in soul.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd iris && python -m pytest tests/test_config_mode.py::test_load_skills_filtered -v`
Expected: FAIL — `load_skills() got an unexpected keyword argument 'skill_names'`

- [ ] **Step 3: Implement skill_names filter**

In `iris/core/skill_loader.py`, update the `load_skills` signature and add the filter (lines 24-46):

```python
def load_skills(
    skills_dir: str,
    context: dict | None = None,
    skill_names: list[str] | None = None,
) -> tuple[list[Tool], str]:
    """
    Scan skills/ folder. For each subfolder:
      - SKILL.md → collected into skill_soul text
      - tools.py → register(context) or TOOLS list → tools
      - config.yaml → loaded into skill-specific config namespace

    Args:
        skill_names: If provided, only load these skill directories.
                     If None, load all (original behavior).

    Returns (all_skill_tools, combined_skill_soul_text).
    """
    skills_path = Path(skills_dir)
    if not skills_path.is_dir():
        return [], ""

    all_tools: list[Tool] = []
    soul_parts: list[str] = []
    seen_tool_names: set[str] = set()

    for skill_dir in sorted(skills_path.iterdir()):
        if not skill_dir.is_dir() or skill_dir.name.startswith((".", "_")):
            continue
        if skill_names is not None and skill_dir.name not in skill_names:
            continue
```

The rest of the function (lines 48-75) remains unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd iris && python -m pytest tests/test_config_mode.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add iris/core/skill_loader.py iris/tests/test_config_mode.py
git commit -m "feat: load_skills accepts skill_names filter for mode selection"
```

---

### Task 4: Add `mode` parameter to `build_harness()`

**Files:**
- Modify: `iris/main.py:78-161`

- [ ] **Step 1: Update build_harness signature and add mode-aware loading**

Replace `build_harness` in `iris/main.py` (lines 78-161):

```python
def build_harness(
    db_path: str = None,
    on_event=None,
    streaming: bool = False,
    mode: str = "analysis",
) -> tuple[Harness, SQLiteRetriever]:
    cfg = load_config()
    h = cfg["harness"]
    budget_cfg = cfg.get("budget", {})
    loop_cfg = cfg.get("loop_detection", {})
    skills_cfg = cfg.get("skills", {})
    mode_cfg = cfg.get("modes", {}).get(mode, {})

    # Mode overrides harness defaults
    max_tool_rounds = mode_cfg.get("max_tool_rounds", h.get("max_tool_rounds", 25))
    max_total_tool_calls = mode_cfg.get("max_total_tool_calls", h.get("max_total_tool_calls", 60))
    max_wall_time = mode_cfg.get("max_wall_time_seconds", h.get("max_wall_time_seconds", 480.0))
    tool_injection_mode = mode_cfg.get("tool_injection_mode", h.get("tool_injection_mode", "dynamic"))
    mode_exposed_tools = mode_cfg.get("always_exposed_tools")
    always_exposed = tuple(mode_exposed_tools) if mode_exposed_tools else tuple(
        h.get("always_exposed_tools", ["query_knowledge", "memory_search"])
    )

    db = db_path or DB_PATH
    retriever = SQLiteRetriever(db)

    # Core tools — external data sources
    core_tools = [
        Tool(exa_search, EXA_SEARCH_SCHEMA),
        Tool(web_fetch, WEB_FETCH_SCHEMA),
        Tool(fmp_get_financials, FMP_GET_FINANCIALS_SCHEMA),
        Tool(fred_get_macro, FRED_GET_MACRO_SCHEMA),
        Tool(yf_quote, YF_QUOTE_SCHEMA),
        Tool(yf_history, YF_HISTORY_SCHEMA),
    ]

    # Memory tools
    memory_tools = [
        Tool(recall_memory, RECALL_MEMORY_SCHEMA),
        Tool(save_memory, SAVE_MEMORY_SCHEMA),
        Tool(check_calibration, CHECK_CALIBRATION_SCHEMA),
        Tool(memory_search, MEMORY_SEARCH_SCHEMA, retriever=retriever),
    ]

    # Knowledge tools (human materials)
    knowledge_tools = [
        Tool(upload_document, UPLOAD_DOCUMENT_SCHEMA, retriever=retriever),
        Tool(search_documents, SEARCH_DOCUMENTS_SCHEMA, retriever=retriever),
    ]

    # Skill tools — mode-filtered
    skills_dir = skills_cfg.get("dir", "./skills")
    skill_name_list = mode_cfg.get("skills")  # None = load all
    skill_tools, skill_soul = load_skills(
        skills_dir,
        context={"retriever": retriever, "mode": mode},
        skill_names=skill_name_list,
    )

    # Register mode in skill config so tools can read it
    from core.config import register_skill_config
    register_skill_config("_runtime", {"mode": mode})

    # Soul — mode-filtered
    soul_file_list = mode_cfg.get("soul_files")  # None = load all
    base_soul = load_soul(file_list=soul_file_list)
    full_soul = base_soul
    if skill_soul:
        full_soul = base_soul + "\n\n---\n\n" + skill_soul

    # Tool set — filter by mode's always_exposed_tools if defined
    all_candidate_tools = core_tools + memory_tools + knowledge_tools + skill_tools
    if mode_exposed_tools:
        exposed_set = set(mode_exposed_tools)
        all_tools = [t for t in all_candidate_tools if t.name in exposed_set]
    else:
        all_tools = all_candidate_tools

    harness = Harness(
        llm=OpenAIClient(),
        tools=all_tools,
        soul=full_soul,
        config=HarnessConfig(
            max_tool_rounds=max_tool_rounds,
            max_total_tool_calls=max_total_tool_calls,
            max_wall_time_seconds=max_wall_time,
            max_retries=h.get("max_retries", 3),
            retry_base_delay=h.get("retry_base_delay", 1.0),
            context_limit_chars=h.get("context_limit_chars", 300000),
            compress_threshold_chars=h.get("compress_threshold_chars", 5000),
            tool_compress_overrides=h.get("tool_compress_overrides", {}),
            tool_injection_mode=tool_injection_mode,
            max_tools_per_round=h.get("max_tools_per_round", 10),
            always_exposed_tools=always_exposed,
            tool_triggers=h.get("tool_triggers", {}),
            include_flush_in_tool_rounds=budget_cfg.get("include_flush_in_tool_rounds", True),
            include_compaction_in_tool_rounds=budget_cfg.get("include_compaction_in_tool_rounds", True),
            pre_round_trim=budget_cfg.get("pre_round_trim", True),
            loop_detection=LoopDetectionConfig(
                generic_repeat_threshold=loop_cfg.get("generic_repeat_threshold", 3),
                ping_pong_threshold=loop_cfg.get("ping_pong_threshold", 3),
                no_progress_threshold=loop_cfg.get("no_progress_threshold", 3),
                action=loop_cfg.get("action", "steer_then_stop"),
            ),
            streaming=streaming,
        ),
        on_event=on_event,
        retriever=retriever,
    )
    return harness, retriever
```

- [ ] **Step 2: Verify existing CLI still works (backward compat)**

Run: `cd iris && python -c "from main import build_harness; h, r = build_harness(); print('OK', len(h.tool_registry), 'tools')"  `
Expected: `OK <N> tools` — no error, mode defaults to "analysis"

- [ ] **Step 3: Commit**

```bash
git add iris/main.py
git commit -m "feat: build_harness accepts mode param for analysis/learning separation"
```

---

### Task 5: Wire mode through API and sessions

**Files:**
- Modify: `iris/backend/api.py:88-90, 192-198`
- Modify: `iris/backend/sessions.py:431`

- [ ] **Step 1: Add mode field to AnalyzeRequest**

In `iris/backend/api.py`, update `AnalyzeRequest` (line 88):

```python
class AnalyzeRequest(BaseModel):
    query: str
    contextDocs: Optional[list[str]] = None
    mode: Optional[str] = "analysis"
```

- [ ] **Step 2: Pass mode to build_harness in start_analysis**

In `iris/backend/api.py`, update `start_analysis` (line 198). Change:

```python
    harness, _retriever = build_harness(streaming=True)
```

to:

```python
    mode = req.mode or "analysis"
    if mode not in ("analysis", "learning"):
        raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")
    harness, _retriever = build_harness(streaming=True, mode=mode)
```

- [ ] **Step 3: Verify API starts without errors**

Run: `cd iris && python -c "from backend.api import app; print('API OK')"`
Expected: `API OK`

- [ ] **Step 4: Commit**

```bash
git add iris/backend/api.py
git commit -m "feat: API accepts mode parameter in analyze request"
```

---

### Task 6: Create soul/reflection.md

**Files:**
- Create: `iris/soul/reflection.md`

- [ ] **Step 1: Write reflection.md**

Create `iris/soul/reflection.md`:

```markdown
# Learning Mode

你现在处于学习模式。你的任务不是分析新公司，而是验证过去的预测、从偏差中提炼方法论、积累可复用的经验。

## 你的工作方式

1. 用户会告诉你复盘哪家公司、哪段交易、或哪个行业
2. 你拉取历史预测和最新实际数据进行对比
3. 你分析偏差原因，提炼出下次可复用的方法论
4. 你把经验存入经验库，供未来分析时 recall

## 关键约束

- 不要做新的分析或估值，你没有分析工具
- 专注于"为什么偏了"和"下次怎么做"
- 方法论越具体越好：具体到该用什么工具、该查什么数据、该怎么验证
- 如果你觉得某条经验适用范围超出单个公司（行业级或更广），标注为 pattern 或 strategic
```

- [ ] **Step 2: Rename analysis_process.md → process.md**

```bash
cd iris && git mv soul/analysis_process.md soul/process.md
```

- [ ] **Step 3: Commit**

```bash
git add iris/soul/reflection.md iris/soul/process.md
git commit -m "feat: add reflection.md soul for learning mode, rename process.md"
```

---

### Task 7: Create reflection skill (SKILL.md + config.yaml)

**Files:**
- Create: `iris/skills/reflection/SKILL.md`
- Create: `iris/skills/reflection/config.yaml`

- [ ] **Step 1: Create skills/reflection directory and SKILL.md**

Create `iris/skills/reflection/SKILL.md`:

```markdown
# Reflection & Learning

## 何时使用
用户要求复盘、验证预测、回顾经验、发现规律时使用。

## 核心原则
- 从事实偏差学习，不从价格波动学习
- 经验要包含方法论：你做了什么、哪里错了、下次怎么做
- factual 和 pattern 级经验你自主写入
- strategic 级经验你只能提议，输出给用户确认
- 即使预测错了，如果推理过程高质量 → 也可以存 golden

## 流程 1：单公司复盘

当用户说"复盘 XXX"、"验证 XXX 的预测"时：

1. recall_memory(company) → 拿到上次分析笔记和预测
2. fmp_get_financials(company) → 最新实际数据
3. 逐个关键指标对比预测 vs 实际，计算偏差
4. 对每个显著偏差，分析原因：
   - 你当时用了什么方法？
   - 为什么偏了？是方法问题还是信息不足？
   - 下次遇到类似情况该怎么做？
5. save_experience → 存入经验，包含 methodology
6. save_memory → 更新公司笔记，加入最新数据
7. 输出复盘报告

## 流程 2：交易复盘

当用户说"复盘交易记录"、"交易表现怎么样"时：

1. 读取 trade_log 中已关闭的交易
2. 统计分析：胜率、按 confidence 分组、按 sector 分组
3. 检查过程纪律：
   - thesis_broken 的是否及时退出？
   - 止损纪律是否执行？
   - confidence 标注和实际胜率是否匹配？
4. 存入统计性经验（不是单笔归因）
5. 输出交易复盘报告

## 流程 3：模式发现

当用户说"看看 XX 行业有没有规律"时，或你在复盘中发现同类经验反复出现时：

1. recall_experiences(sector=xxx) → 所有相关经验
2. 寻找重复模式
3. distill_patterns → 总结成可复用的方法论模板
4. save_experience(level="pattern") → 存入

## 评估标准

分开评估，分开记录：
- 预测方向对不对（涨了还是跌了）
- 预测幅度准不准（偏差多大）
- 推理过程质量（逻辑是否自洽，是否考虑了反驳证据）
```

- [ ] **Step 2: Create config.yaml**

Create `iris/skills/reflection/config.yaml`:

```yaml
name: reflection
description: 季度复盘与经验学习
trigger_keywords: [复盘, 验证, reflection, 回顾, 校准, calibration, 学习, 教训]
```

- [ ] **Step 3: Commit**

```bash
git add iris/skills/reflection/
git commit -m "feat: add reflection skill for learning mode"
```

---

## Chunk 2: Experience Schema Upgrade

### Task 8: Add methodology field to save_experience

**Files:**
- Modify: `iris/skills/experience/tools.py:87-144, 324-449`
- Test: `iris/tests/test_experience_mode.py` (create)

- [ ] **Step 1: Write failing tests**

Create `iris/tests/test_experience_mode.py`:

```python
"""Tests for experience mode-awareness and methodology field."""
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from core.config import register_skill_config, reset_skill_configs
from tools.base import ToolResult


def _setup_experience_config():
    """Register minimal experience skill config."""
    reset_skill_configs()
    register_skill_config("experience", {
        "retrieval": {"top_k": 5, "company_boost": 1.0, "sector_boost": 0.7, "semantic_boost": 0.5, "min_confidence": 0.3},
        "update": {"duplicate_threshold": 0.90, "merge_threshold": 0.70},
        "quality": {"max_library_size": 500},
        "reflection": {"min_error_for_warning": 0.03, "min_accuracy_for_golden": 0.02},
        "distillation": {"cross_company_pattern_threshold": 3},
    })


def test_save_experience_with_methodology(tmp_path):
    """save_experience accepts and stores methodology field."""
    _setup_experience_config()
    from skills.experience.tools import save_experience, _library_path

    with patch.object(
        __import__("skills.experience.tools", fromlist=["_library_path"]),
        "_library_path",
        return_value=tmp_path / "exp.json",
    ):
        result = save_experience(
            zone="warning",
            level="factual",
            content="NVDA DC revenue underestimated",
            companies=["NVDA"],
            confidence=0.8,
            methodology={
                "what_i_did": "linear extrapolation of 3yr CAGR",
                "what_went_wrong": "AI adoption is exponential",
                "what_to_do_next": ["check hyperscaler capex", "apply 1.4-1.8x multiplier"],
            },
        )
        assert result.status == "ok"
        assert result.data["action"] == "inserted"

        # Verify methodology stored
        lib = json.loads((tmp_path / "exp.json").read_text())
        entry = lib["experiences"][0]
        assert entry["methodology"]["what_i_did"] == "linear extrapolation of 3yr CAGR"
        assert len(entry["methodology"]["what_to_do_next"]) == 2


def test_save_experience_analysis_mode_strips_zone(tmp_path):
    """In analysis mode, zone and level are stripped from saved entry."""
    _setup_experience_config()
    register_skill_config("_runtime", {"mode": "analysis"})

    from skills.experience.tools import save_experience

    with patch.object(
        __import__("skills.experience.tools", fromlist=["_library_path"]),
        "_library_path",
        return_value=tmp_path / "exp.json",
    ):
        result = save_experience(
            zone="golden",
            level="pattern",
            content="I used linear extrapolation",
            companies=["NVDA"],
            confidence=0.6,
        )
        assert result.status == "ok"

        lib = json.loads((tmp_path / "exp.json").read_text())
        entry = lib["experiences"][0]
        # zone and level should be absent or None
        assert entry.get("zone") is None
        assert entry.get("level") is None


def test_save_experience_learning_mode_keeps_zone(tmp_path):
    """In learning mode, zone and level are preserved."""
    _setup_experience_config()
    register_skill_config("_runtime", {"mode": "learning"})

    from skills.experience.tools import save_experience

    with patch.object(
        __import__("skills.experience.tools", fromlist=["_library_path"]),
        "_library_path",
        return_value=tmp_path / "exp.json",
    ):
        result = save_experience(
            zone="warning",
            level="factual",
            content="Revenue was underestimated by 43pp",
            companies=["NVDA"],
            confidence=0.8,
        )
        assert result.status == "ok"

        lib = json.loads((tmp_path / "exp.json").read_text())
        entry = lib["experiences"][0]
        assert entry["zone"] == "warning"
        assert entry["level"] == "factual"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd iris && python -m pytest tests/test_experience_mode.py -v`
Expected: FAIL — `save_experience() got an unexpected keyword argument 'methodology'`

- [ ] **Step 3: Update SAVE_EXPERIENCE_SCHEMA**

In `iris/skills/experience/tools.py`, add `methodology` to the schema properties (after line 141, before the closing `}`), and change `required`:

Add this property after `source_attribution_id` (line 141):

```python
        "methodology": {
            "type": "object",
            "description": (
                "Procedural knowledge: what method you used, what went wrong, "
                "what to do next time. Be specific about tools and data sources."
            ),
            "properties": {
                "what_i_did": {"type": "string", "description": "Method used in this analysis"},
                "what_went_wrong": {"type": "string", "description": "Filled during reflection: why the prediction deviated"},
                "what_to_do_next": {
                    "type": "array", "items": {"type": "string"},
                    "description": "Filled during reflection: actionable steps for next time",
                },
            },
        },
```

Change line 143 from:

```python
    required=["zone", "level", "content", "companies", "confidence"],
```

to:

```python
    required=["content", "companies", "confidence"],
```

- [ ] **Step 4: Update save_experience function**

In `iris/skills/experience/tools.py`, update the `save_experience` function signature (line 324) and add mode-awareness:

```python
def save_experience(
    zone: str = None,
    level: str = None,
    content: str = "",
    companies: list[str] = None,
    confidence: float = 0.5,
    sector: str = "",
    evidence: list[dict] = None,
    source_attribution_id: str = "",
    methodology: dict = None,
) -> ToolResult:
    """Save a new experience entry with FLEX-style three-way dedup."""
    # Mode-awareness: in analysis mode, strip zone/level
    runtime_cfg = get_skill_config("_runtime")
    current_mode = runtime_cfg.get("mode", "learning") if runtime_cfg else "learning"
    if current_mode == "analysis":
        zone = None
        level = None

    companies = companies or []
```

Then in the "Novel — insert new" block (around line 422), add `methodology` to the new entry dict. After `"source_attribution_id": source_attribution_id,` add:

```python
        "methodology": methodology,
```

Also update the strategic-level early return block (around line 343) to pass through methodology in the proposed_entry.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd iris && python -m pytest tests/test_experience_mode.py -v`
Expected: 3 passed

- [ ] **Step 6: Run existing experience tests to verify no regression**

Run: `cd iris && python -m pytest tests/ -v -k "experience or memory" --tb=short`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
git add iris/skills/experience/tools.py iris/tests/test_experience_mode.py
git commit -m "feat: save_experience gains methodology field and mode-aware zone stripping"
```

---

### Task 9: Update recall_experiences to skip entries without zone

**Files:**
- Modify: `iris/skills/experience/tools.py:246-308`

- [ ] **Step 1: Update zone filtering in recall_experiences**

In `iris/skills/experience/tools.py`, the zone split logic (lines 288-308) currently assumes every entry has a `zone`. Entries saved in analysis mode won't have one. Update the split:

Change lines 288-308 from checking `e["zone"]` to using `.get()`:

```python
    warnings = [
        {
            "id": e["id"],
            "content": e["content"],
            "level": e.get("level", "factual"),
            "confidence": e.get("confidence", 0.5),
            "evidence_count": e.get("evidence_count", 0),
            "companies": e.get("companies", []),
            "methodology": e.get("methodology"),
        }
        for e, _ in top_entries if e.get("zone") == "warning"
    ]
    goldens = [
        {
            "id": e["id"],
            "content": e["content"],
            "level": e.get("level", "factual"),
            "confidence": e.get("confidence", 0.5),
            "evidence_count": e.get("evidence_count", 0),
            "companies": e.get("companies", []),
            "methodology": e.get("methodology"),
        }
        for e, _ in top_entries if e.get("zone") == "golden"
    ]
```

This naturally excludes entries without a zone (analysis-mode pending entries) from being returned as warnings or goldens.

Also add `methodology` to the returned fields so the agent can see procedural knowledge during recall.

- [ ] **Step 2: Commit**

```bash
git add iris/skills/experience/tools.py
git commit -m "fix: recall_experiences handles entries without zone, returns methodology"
```

---

## Chunk 3: End-to-End Verification

### Task 10: Integration test — learning mode builds successfully

**Files:**
- Test: `iris/tests/test_config_mode.py` (append)

- [ ] **Step 1: Write integration test**

Append to `iris/tests/test_config_mode.py`:

```python
def test_build_harness_analysis_mode():
    """build_harness with mode='analysis' produces a valid harness."""
    from main import build_harness
    harness, retriever = build_harness(mode="analysis")
    tool_names = set(harness.tool_registry.keys())
    assert "build_dcf" in tool_names
    assert "run_reflection" not in tool_names  # learning-only


def test_build_harness_learning_mode():
    """build_harness with mode='learning' produces a harness with learning tools."""
    from main import build_harness
    harness, retriever = build_harness(mode="learning")
    tool_names = set(harness.tool_registry.keys())
    assert "run_reflection" in tool_names
    assert "save_experience" in tool_names
    assert "recall_experiences" in tool_names
    assert "build_dcf" not in tool_names  # analysis-only
    assert "exa_search" not in tool_names  # analysis-only


def test_build_harness_learning_mode_soul_has_reflection():
    """Learning mode soul includes reflection.md content."""
    from main import build_harness
    harness, _ = build_harness(mode="learning")
    assert "学习模式" in harness.soul or "Learning Mode" in harness.soul


def test_build_harness_default_mode_is_analysis():
    """Default mode is analysis (backward compatible)."""
    from main import build_harness
    harness, _ = build_harness()
    tool_names = set(harness.tool_registry.keys())
    assert "build_dcf" in tool_names
```

- [ ] **Step 2: Run all tests**

Run: `cd iris && python -m pytest tests/test_config_mode.py -v`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add iris/tests/test_config_mode.py
git commit -m "test: integration tests for analysis/learning mode harness construction"
```

---

### Task 11: Frontend — add mode support to API client and learning mode entry

**Files:**
- Modify: `iris-frontend/src/utils/api.ts`
- Modify: `iris-frontend/src/components/WatchlistCard.tsx`

- [ ] **Step 1: Add mode to startAnalysis API call**

In `iris-frontend/src/utils/api.ts`, find the `startAnalysis` function and add `mode` parameter:

```typescript
export async function startAnalysis(
  query: string,
  contextDocs?: string[],
  mode: string = 'analysis'
): Promise<{ analysisId: string; streamUrl: string }> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, contextDocs, mode }),
  });
  if (!res.ok) throw new Error(`Start analysis failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Add "复盘" button to WatchlistCard**

In `iris-frontend/src/components/WatchlistCard.tsx`, add a reflection button alongside existing actions. The button should call `startAnalysis` with `mode: 'learning'` and a pre-filled prompt:

```typescript
const handleReflection = () => {
  const query = `复盘 ${ticker} 的最新财报表现`;
  startAnalysis(query, undefined, 'learning').then(({ analysisId, streamUrl }) => {
    // Navigate to analysis page with this session
    router.push(`/analysis?id=${analysisId}&mode=learning`);
  });
};
```

Add the button in the card's action area:

```tsx
<button
  onClick={handleReflection}
  className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
  title="验证预测"
>
  复盘
</button>
```

- [ ] **Step 3: Commit**

```bash
git add iris-frontend/src/utils/api.ts iris-frontend/src/components/WatchlistCard.tsx
git commit -m "feat: frontend supports learning mode via API and watchlist reflection button"
```

---

### Task 12: Manual end-to-end verification

This task is manual — run the system and verify the learning loop works.

- [ ] **Step 1: Start backend**

```bash
cd iris && uvicorn backend.api:app --reload --port 8000
```

- [ ] **Step 2: Test learning mode via API**

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "复盘 AAPL 的最新财报表现", "mode": "learning"}'
```

Expected: Returns `{"analysisId": "...", "streamUrl": "..."}`. The agent should:
1. Call `recall_memory("AAPL")`
2. Call `fmp_get_financials("AAPL")`
3. Compare predictions vs actuals
4. Call `save_experience` with methodology
5. Output a reflection report

- [ ] **Step 3: Verify experience was saved**

```bash
cat iris/memory/experience_library.json | python -m json.tool
```

Expected: File exists with at least one entry containing a `methodology` field.

- [ ] **Step 4: Test analysis mode still works**

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "分析 MSFT 的基本面"}'
```

Expected: Normal analysis, `build_dcf` and `exa_search` are available, `run_reflection` is not.

- [ ] **Step 5: Verify analysis mode save_experience strips zone**

If the agent calls `save_experience` during analysis, check `experience_library.json` — the entry should have `zone: null` and `level: null`.
