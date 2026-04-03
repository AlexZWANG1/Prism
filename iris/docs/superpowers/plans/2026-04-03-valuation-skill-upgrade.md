# Valuation Skill Full Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the IRIS valuation skill to produce three-statement-linked DCF models with live-formula Excel export, sell-side data comparison, and richer frontend display — all driven by SKILL.md methodology (no hardcoded logic).

**Architecture:** The DCF engine remains a pure calculator — LLM derives all assumptions via SKILL.md guidance. Engine accepts expanded inputs (BS/CF items), outputs richer year-by-year data, and generates openpyxl workbooks with live formulas. Frontend ModelPanel gains warnings, cross-check, assumptions display, and Excel download. Document parser upgrades Docling to default and adds structured Excel formula extraction.

**Tech Stack:** Python (openpyxl, formulas, docling), Next.js/React (TypeScript), Zustand store

---

## File Structure

### Backend (Python) — Modified
| File | Responsibility |
|------|---------------|
| `iris/skills/valuation/SKILL.md` | LLM methodology: three-statement framework, sell-side comparison, multi-source data |
| `iris/skills/dcf/tools.py` | DCF engine: expanded schema, richer output, Excel export |
| `iris/skills/dcf/config.yaml` | New config keys for Excel, BS/CF defaults |
| `iris/skills/valuation/tools.py` | Unified interface: add `export_excel` mode |
| `iris/tools/document_parser.py` | Enhanced Excel parsing (formulas + structure), Docling default |
| `iris/backend/api.py` | Excel download endpoint |

### Frontend (TypeScript) — Modified
| File | Responsibility |
|------|---------------|
| `iris-frontend/src/types/analysis.ts` | Expanded ModelPanelState types |
| `iris-frontend/src/components/ModelPanel.tsx` | Render warnings, cross-check, assumptions, download button |
| `iris-frontend/src/components/AssumptionList.tsx` | Already exists, wire into ModelPanel |
| `iris-frontend/src/components/WarningsBanner.tsx` | New — display DCF warnings |
| `iris-frontend/src/components/CrossCheckBadge.tsx` | New — display cross-check status |
| `iris-frontend/src/hooks/useAnalysisStore.ts` | Extract expanded DCF output fields |
| `iris-frontend/src/utils/api.ts` | Excel download helper |

---

## Chunk 1: SKILL.md Three-Statement Methodology

### Task 1: Add three-statement derivation framework to SKILL.md

**Files:**
- Modify: `iris/skills/valuation/SKILL.md`

- [ ] **Step 1: Add three-statement section after "假设推导框架"**

Insert a new `## 三表联动推导框架` section after line 93 of SKILL.md. Content:

```markdown
## 三表联动推导框架（P&L → BS → CF → DCF）

**DCF 的假设不是独立参数 — 它们是三张报表的联动结果。** 推导顺序：

### Step 1: 搭建 P&L (Income Statement)

从 `financials(ticker, 'income-statement')` 拿到历史，然后逐年预测：

```
Revenue        = Σ(segments × growth_rates)          ← 你已经在做
COGS           = Revenue × (1 - gross_margin)
Gross Profit   = Revenue - COGS
SGA            = Revenue × sga_pct                    ← 新参数
R&D            = Revenue × rd_pct                     ← 新参数
Total OpEx     = SGA + R&D  (或直接用 opex_pct_of_revenue)
EBIT           = Gross Profit - Total OpEx
Interest Exp   = Avg Debt × cost_of_debt              ← 从 BS 联动
EBT            = EBIT - Interest Expense
Tax            = EBT × tax_rate
Net Income     = EBT - Tax
```

**可选拆分**: 如果你有 SGA 和 R&D 的历史数据，分开建模更精确。
否则用 `opex_pct_of_revenue` 一把搞定（当前做法不变）。

### Step 2: 搭建 BS (Balance Sheet)

从 `financials(ticker, 'balance-sheet-statement')` 拿到历史，用 Revenue 驱动：

```
Working Capital 资产:
  Accounts Receivable = Revenue × days_receivable / 365
  Inventory           = COGS × days_inventory / 365
  Prepaid & Other     = Revenue × other_ca_pct

Working Capital 负债:
  Accounts Payable    = COGS × days_payable / 365
  Accrued Liabilities = Revenue × accrued_pct

Net Working Capital   = (AR + Inventory + Prepaid) - (AP + Accrued)
ΔWC                   = NWC(t) - NWC(t-1)                ← 回到 CF

固定资产:
  PP&E(t)  = PP&E(t-1) + CapEx - D&A                     ← 从 CF 联动
  
Debt Schedule:
  Total Debt(t) = Total Debt(t-1) + New Issuance - Repayment
  Cash(t) = Cash(t-1) + Net CF (from CF statement)
```

**简化选项**: 如果你不想拆分 WC 明细，仍可用
`working_capital_change_pct` × Revenue 一步到位。但如果知识库里有卖方模型
的 WC 明细，优先用明细数据。

### Step 3: 搭建 CF (Cash Flow Statement)

```
Operating CF:
  Net Income
  + D&A                    (非现金费用加回)
  + Stock-Based Comp       (sbc_pct × Revenue, 可选)
  - ΔWC                    (从 BS 联动)
  = CFO

Investing CF:
  - CapEx                  (capex_pct × Revenue)
  = CFI

Financing CF:
  - Debt Repayment
  + New Debt Issuance
  - Dividends              (可选)
  - Buybacks               (可选)
  = CFF

Free Cash Flow (for DCF):
  FCF = NOPAT + D&A - CapEx - ΔWC     ← 当前公式不变
  或 FCF = CFO - CapEx                  ← 等价（unlevered 用第一个）
```

### 联动检查

每次调 DCF 前，在 `<thinking>` 中确认三表平衡：

```
✓ BS 平衡: Total Assets = Total Liabilities + Equity
✓ CF 回连 BS: Cash(t) = Cash(t-1) + CFO + CFI + CFF
✓ NI 联动: P&L Net Income = CF 起点
✓ D&A 联动: CF 中加回的 D&A = P&L 中计提的 D&A
✓ CapEx 联动: CF 中 CapEx = BS 中 PP&E 变动 + D&A
```

**如果你只想做简单 DCF（不建三表），当前的参数集完全够用。**
三表推导是在复杂场景下确保假设一致性的方法，不是必须的。
```

- [ ] **Step 2: Verify markdown renders correctly**

Run: `python -c "open('iris/skills/valuation/SKILL.md').read()" `
Expected: No encoding errors

- [ ] **Step 3: Commit**

```bash
git add iris/skills/valuation/SKILL.md
git commit -m "docs(valuation): add three-statement derivation framework to SKILL.md"
```

### Task 2: Add sell-side data comparison protocol to SKILL.md

**Files:**
- Modify: `iris/skills/valuation/SKILL.md`

- [ ] **Step 1: Add sell-side comparison section after 三表联动**

```markdown
## 卖方数据对比协议

**你的假设必须与市场做对比。** 如果用户上传了卖方研报或 Excel 模型，
用 `search_knowledge` 提取卖方预期，作为 sanity check。

### 数据获取（按优先级）

```
1. MCP 数据源 (如果配置了):
   - Daloopa / FactSet / Morningstar → 直接结构化数据
   - 最准确，无需解析

2. 用户上传的卖方研报/Excel:
   - search_knowledge("XX公司 revenue forecast")
   - search_knowledge("XX公司 DCF assumptions WACC")
   - search_knowledge("XX公司 target price consensus")
   - 提取关键数字: Y1-Y3 revenue growth, margin, WACC, target price

3. IRIS 内置工具:
   - financials() → 历史数据
   - quote() → 市场数据
   - macro() → 宏观指标

4. Web search (最后选择):
   - web_search("NVDA consensus revenue estimate 2026")
   - 仅用于验证，不作为主要来源
```

### 对比输出格式

在分析结论中，如果有卖方数据，必须展示对比表：

```
| 假设 | IRIS (本次) | 卖方一致预期 | 偏差 | 说明 |
|------|-----------|------------|------|------|
| Y1 Revenue Growth | 45% | 38% | +7pp | IRIS 更看好 AI capex cycle |
| Gross Margin | 73% | 72% | +1pp | 基本一致 |
| WACC | 11.0% | 10.5% | +0.5pp | IRIS 稍保守 |
| Target Price | $185 | $200 | -8% | 卖方更乐观 |
```

### 偏差解读

```
偏差 < ±10%:  假设合理，与市场共识一致
偏差 ±10-25%: 需要在分析中明确解释原因
偏差 > ±25%:  重大偏离 — 必须说明你的独立判断依据
```

**不要无脑跟卖方。** 卖方预期是 anchor，不是答案。
你的分析价值在于独立判断 + 透明假设。
```

- [ ] **Step 2: Commit**

```bash
git add iris/skills/valuation/SKILL.md
git commit -m "docs(valuation): add sell-side data comparison protocol"
```

### Task 3: Add multi-source data guidance to SKILL.md

**Files:**
- Modify: `iris/skills/valuation/SKILL.md`

- [ ] **Step 1: Add multi-source section before 错误防范清单**

```markdown
## 多数据源使用指导

IRIS 支持多种数据来源。根据可用性和准确度选择：

### 数据源优先级矩阵

| 数据类型 | 首选来源 | 备选来源 | 注意事项 |
|---------|---------|---------|---------|
| 历史财务数据 | `financials()` (FMP API) | 知识库中的卖方 Excel | FMP 数据标准化程度高 |
| 实时市场数据 | `quote()` | Web search | quote() 有 15min 延迟 |
| 宏观指标 | `macro()` (FRED) | Web search | FRED 覆盖全面 |
| 一致预期/估计 | `search_knowledge()` 卖方研报 | Web search | 优先用已上传的材料 |
| Segment 收入拆分 | `financials(type='segments')` | SEC filing, 卖方研报 | 某些公司不披露 |
| 管理层 Guidance | `search_knowledge()` 电话会纪要 | Web search | 关注措辞变化 |
| Peer 选择 | `get_comps()` 自动 | 卖方研报的 peer group | 优先用卖方定义的 peer |

### 使用 search_knowledge 的时机

```
每次建 DCF 前，如果知识库不为空，主动搜索一次:
  search_knowledge("{ticker} revenue growth forecast")
  search_knowledge("{ticker} DCF assumptions")
  search_knowledge("{ticker} target price")

如果有结果 → 提取关键数字，在 <thinking> 中与自己的推导对比
如果无结果 → 跳过，正常推导
```
```

- [ ] **Step 2: Commit**

```bash
git add iris/skills/valuation/SKILL.md
git commit -m "docs(valuation): add multi-source data guidance"
```

---

## Chunk 2: DCF Engine — Expanded Schema & Richer Output

### Task 4: Expand assumptions schema to accept three-statement inputs

**Files:**
- Modify: `iris/skills/dcf/tools.py`

The engine remains a calculator. LLM can now optionally pass BS/CF detail fields.
If not passed, engine falls back to current simplified logic.

- [ ] **Step 1: Write test for expanded assumptions acceptance**

Create: `iris/tests/test_dcf_expanded.py`

```python
"""Tests for expanded DCF assumptions (three-statement fields)."""
import pytest
from skills.dcf.tools import build_dcf

BASE_ASSUMPTIONS = {
    "company": "TestCo",
    "ticker": "TEST",
    "projection_years": 3,
    "segments": [
        {"name": "Main", "current_annual_revenue": 10000,
         "growth_rates": [0.10, 0.08, 0.06]}
    ],
    "gross_margin": {"value": 0.60},
    "opex_pct_of_revenue": {"value": 0.20},
    "wacc": 0.10,
    "terminal_growth": 0.03,
    "net_cash": 500,
    "shares_outstanding": 100_000_000,
    "current_price": 50.0,
}

def test_base_still_works():
    """Existing simple assumptions still produce valid output."""
    result = build_dcf(BASE_ASSUMPTIONS)
    assert result.status == "ok"
    assert result.data["fair_value_per_share"] > 0
    assert len(result.data["year_by_year"]) == 3

def test_expanded_bs_fields_accepted():
    """Engine accepts optional BS detail fields without error."""
    expanded = {**BASE_ASSUMPTIONS,
        "days_receivable": {"value": 45},
        "days_inventory": {"value": 30},
        "days_payable": {"value": 40},
        "sga_pct_of_revenue": {"value": 0.10},
        "rd_pct_of_revenue": {"value": 0.10},
        "sbc_pct_of_revenue": {"value": 0.02},
    }
    result = build_dcf(expanded)
    assert result.status == "ok"
    # Year-by-year should now include bs_detail if provided
    yby = result.data["year_by_year"]
    assert "accounts_receivable" in yby[0] or "nwc" in yby[0]

def test_expanded_output_has_three_statement_fields():
    """With expanded inputs, output includes P&L, BS, CF detail."""
    expanded = {**BASE_ASSUMPTIONS,
        "days_receivable": {"value": 45},
        "days_inventory": {"value": 30},
        "days_payable": {"value": 40},
    }
    result = build_dcf(expanded)
    assert result.status == "ok"
    yby = result.data["year_by_year"][0]
    # Should have NWC-related fields
    assert "nwc" in yby
    assert "delta_wc" in yby

def test_sell_side_anchor_passthrough():
    """sell_side_anchor field passes through to output for comparison."""
    anchored = {**BASE_ASSUMPTIONS,
        "sell_side_anchor": {
            "source": "Goldman Sachs",
            "y1_revenue_growth": 0.12,
            "gross_margin": 0.58,
            "wacc": 0.095,
            "target_price": 65.0,
        },
    }
    result = build_dcf(anchored)
    assert result.status == "ok"
    assert result.data.get("sell_side_anchor") is not None
    assert result.data["sell_side_anchor"]["source"] == "Goldman Sachs"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd iris && python -m pytest tests/test_dcf_expanded.py -v`
Expected: `test_base_still_works` PASS, others FAIL (new fields not yet handled)

- [ ] **Step 3: Expand `_compute_dcf` to output BS/CF detail**

Modify `iris/skills/dcf/tools.py` — in `_compute_dcf`, add optional BS detail fields to year_by_year output. Add new parameters with defaults that preserve backward compat:

```python
def _compute_dcf(
    segments, projection_years, gross_margin, opex_pct, tax_rate,
    capex_pct, da_pct, wc_change_pct, wacc, terminal_growth,
    net_cash, shares_outstanding, current_price,
    # New optional three-statement params (all default None → use simplified)
    days_receivable=None, days_inventory=None, days_payable=None,
    sga_pct=None, rd_pct=None, sbc_pct=None,
    initial_receivable=None, initial_inventory=None, initial_payable=None,
) -> dict:
    # ... existing code ...
    prev_nwc_val = 0  # initialized before loop for BS detail tracking
```

Inside the year loop, after computing revenue/cogs/fcf, add:

```python
        # --- Three-statement detail (optional) ---
        row = {
            "year": t + 1,
            "revenue": round(total_revenue, 2),
            "revenue_growth": round(revenue_growth, 4),
            "cogs": round(cogs, 2),
            "gross_profit": round(gross_profit, 2),
            "total_opex": round(opex, 2),
            "ebit": round(ebit, 2),
            "nopat": round(nopat, 2),
            "da": round(da, 2),
            "capex": round(capex, 2),
            "fcf": round(fcf, 2),
            "discounted_fcf": round(discounted_fcf, 2),
        }

        # SGA / R&D detail (only if LLM explicitly provided them)
        if sga_pct is not None:
            row["sga"] = round(total_revenue * sga_pct[t], 2)
        if rd_pct is not None:
            row["rd"] = round(total_revenue * rd_pct[t], 2)

        # BS detail: NWC breakdown if days provided
        # NOTE: prev_nwc_val must be initialized to 0 BEFORE the for-loop
        if days_receivable is not None:
            ar = total_revenue * days_receivable[t] / 365
            inv = cogs * (days_inventory[t] if days_inventory else 0) / 365
            ap = cogs * (days_payable[t] if days_payable else 0) / 365
            nwc = ar + inv - ap
            prev_nwc = prev_nwc_val if t > 0 else (initial_receivable or 0) + (initial_inventory or 0) - (initial_payable or 0)
            delta_wc_detail = nwc - prev_nwc
            prev_nwc_val = nwc
            row.update({
                "accounts_receivable": round(ar, 2),
                "inventory": round(inv, 2),
                "accounts_payable": round(ap, 2),
                "nwc": round(nwc, 2),
                "delta_wc": round(delta_wc_detail, 2),
            })
            # Override FCF with detailed WC
            fcf = nopat + da - capex - delta_wc_detail
            row["fcf"] = round(fcf, 2)
            row["discounted_fcf"] = round(fcf / discount_factor, 2)
        else:
            row["nwc"] = round(total_revenue * wc_change_pct[t], 2)
            row["delta_wc"] = round(delta_wc, 2)

        # SBC passthrough
        if sbc_pct:
            row["sbc"] = round(total_revenue * sbc_pct[t], 2)

        year_by_year.append(row)
```

- [ ] **Step 4: Wire new params through `build_dcf` to `_compute_dcf`**

In `build_dcf()`, after resolving existing params, add:

```python
    # Optional three-statement detail params (None = not provided → use simplified mode)
    days_receivable = _resolve_optional_per_year(assumptions.get("days_receivable"), projection_years)
    days_inventory = _resolve_optional_per_year(assumptions.get("days_inventory"), projection_years)
    days_payable = _resolve_optional_per_year(assumptions.get("days_payable"), projection_years)
    sga_pct = _resolve_optional_per_year(assumptions.get("sga_pct_of_revenue"), projection_years)
    rd_pct = _resolve_optional_per_year(assumptions.get("rd_pct_of_revenue"), projection_years)
    sbc_pct = _resolve_optional_per_year(assumptions.get("sbc_pct_of_revenue"), projection_years)
    
    # Pass None explicitly if user didn't provide (signals simplified mode)
    has_bs_detail = assumptions.get("days_receivable") is not None
```

Add a separate helper for optional params (keeps existing `_resolve_per_year` untouched):

```python
def _resolve_optional_per_year(param: Any, n_years: int) -> list[float] | None:
    """Like _resolve_per_year but returns None when param is absent (signals 'not provided')."""
    if param is None:
        return None
    if isinstance(param, dict):
        return [param.get("value", 0)] * n_years
    if isinstance(param, list):
        return [float(v) for v in param]
    return [float(param)] * n_years
```

Pass `sell_side_anchor` through to output:

```python
    result["sell_side_anchor"] = assumptions.get("sell_side_anchor")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd iris && python -m pytest tests/test_dcf_expanded.py -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add iris/skills/dcf/tools.py iris/tests/test_dcf_expanded.py
git commit -m "feat(dcf): expand engine to accept three-statement inputs and output BS/CF detail"
```

### Task 5: Update BUILD_DCF_SCHEMA description

**Files:**
- Modify: `iris/skills/dcf/tools.py`

- [ ] **Step 1: Update schema description to document new optional fields**

Add to `BUILD_DCF_SCHEMA` properties.assumptions.description:

```python
"Optional three-statement detail fields (if you have the data):\n"
"  days_receivable ({value: int} or [int per year]): AR days (AR = Revenue × days/365)\n"
"  days_inventory ({value: int} or [int per year]): Inventory days (Inv = COGS × days/365)\n"
"  days_payable ({value: int} or [int per year]): AP days (AP = COGS × days/365)\n"
"  sga_pct_of_revenue ({value: float} or [float per year]): SG&A as fraction of revenue\n"
"  rd_pct_of_revenue ({value: float} or [float per year]): R&D as fraction of revenue\n"
"  sbc_pct_of_revenue ({value: float} or [float per year]): Stock-based comp as fraction of revenue\n"
"  sell_side_anchor (object): Optional sell-side consensus for comparison display\n"
"    {source, y1_revenue_growth, gross_margin, wacc, target_price}\n"
```

- [ ] **Step 2: Commit**

```bash
git add iris/skills/dcf/tools.py
git commit -m "docs(dcf): update schema description with three-statement optional fields"
```

---

## Chunk 3: Excel Export with Live Formulas

### Task 6: Create Excel export function

**Files:**
- Create: `iris/skills/dcf/excel_export.py`
- Test: `iris/tests/test_excel_export.py`

- [ ] **Step 1: Write test for Excel export**

```python
"""Tests for DCF Excel export with live formulas."""
import os, pytest
from skills.dcf.tools import build_dcf
from skills.dcf.excel_export import export_dcf_excel

BASE = {
    "company": "TestCo", "ticker": "TEST", "projection_years": 3,
    "segments": [{"name": "Main", "current_annual_revenue": 10000,
                  "growth_rates": [0.10, 0.08, 0.06]}],
    "gross_margin": {"value": 0.60},
    "opex_pct_of_revenue": {"value": 0.20},
    "wacc": 0.10, "terminal_growth": 0.03,
    "net_cash": 500, "shares_outstanding": 100_000_000,
    "current_price": 50.0,
}

def test_export_creates_file(tmp_path):
    result = build_dcf(BASE)
    assert result.status == "ok"
    path = tmp_path / "test_dcf.xlsx"
    export_dcf_excel(result.data, BASE, str(path))
    assert path.exists()
    assert path.stat().st_size > 5000  # non-trivial file

def test_export_has_all_sheets(tmp_path):
    result = build_dcf(BASE)
    path = tmp_path / "test_dcf.xlsx"
    export_dcf_excel(result.data, BASE, str(path))
    from openpyxl import load_workbook
    wb = load_workbook(str(path))
    names = wb.sheetnames
    assert "Summary" in names
    assert "P&L" in names
    assert "DCF" in names
    assert "Sensitivity" in names

def test_export_has_live_formulas(tmp_path):
    result = build_dcf(BASE)
    path = tmp_path / "test_dcf.xlsx"
    export_dcf_excel(result.data, BASE, str(path))
    from openpyxl import load_workbook
    wb = load_workbook(str(path))
    dcf_ws = wb["DCF"]
    # At least some cells should contain formulas (start with =)
    has_formula = False
    for row in dcf_ws.iter_rows():
        for cell in row:
            if isinstance(cell.value, str) and cell.value.startswith("="):
                has_formula = True
                break
    assert has_formula, "DCF sheet should have live formulas"

def test_export_blue_black_green_colors(tmp_path):
    result = build_dcf(BASE)
    path = tmp_path / "test_dcf.xlsx"
    export_dcf_excel(result.data, BASE, str(path))
    from openpyxl import load_workbook
    wb = load_workbook(str(path))
    # Check that input cells use blue font (investment banking convention)
    assumptions_ws = wb["Summary"]
    found_blue = False
    for row in assumptions_ws.iter_rows():
        for cell in row:
            if cell.font and cell.font.color and cell.font.color.rgb:
                rgb = str(cell.font.color.rgb)
                if "0000FF" in rgb.upper() or "0066CC" in rgb.upper():
                    found_blue = True
    assert found_blue, "Input cells should use blue font"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd iris && python -m pytest tests/test_excel_export.py -v`
Expected: ImportError (excel_export.py doesn't exist yet)

- [ ] **Step 3: Implement `export_dcf_excel`**

Create `iris/skills/dcf/excel_export.py`:

```python
"""
DCF Excel Export — generates .xlsx workbook with live formulas.

Sheets: Summary | P&L | BS (if detail) | DCF | Sensitivity | Comps (if data)
Convention: Blue font = input, Black = formula, Green = output.
"""
from __future__ import annotations
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from openpyxl.utils import get_column_letter


# ── Style constants (IB convention) ──
BLUE_FONT = Font(name="Calibri", size=10, color="0066CC")         # Input
BLACK_FONT = Font(name="Calibri", size=10, color="000000")        # Formula
GREEN_FONT = Font(name="Calibri", size=10, color="006100", bold=True)  # Output
HEADER_FONT = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
HEADER_FILL = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
SECTION_FONT = Font(name="Calibri", size=10, bold=True)
LIGHT_FILL = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
THIN_BORDER = Border(bottom=Side(style="thin", color="B0B0B0"))
PCT_FMT = "0.0%"
NUM_FMT = "#,##0.0"
DOLLAR_FMT = "$#,##0.00"
DOLLAR_M_FMT = '#,##0.0,,"M"'


def export_dcf_excel(
    dcf_result: dict,
    assumptions: dict,
    output_path: str,
    comps_data: dict | None = None,
) -> str:
    """Generate Excel workbook with live formulas. Returns output_path."""
    wb = Workbook()
    
    yby = dcf_result.get("year_by_year", [])
    n_years = len(yby)
    segments = assumptions.get("segments", [])
    
    _build_summary_sheet(wb, dcf_result, assumptions)
    _build_pl_sheet(wb, yby, assumptions, n_years)
    _build_dcf_sheet(wb, dcf_result, assumptions, n_years)
    _build_sensitivity_sheet(wb, dcf_result)
    if comps_data:
        _build_comps_sheet(wb, comps_data)
    
    # Remove default empty sheet if still there
    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]
    
    wb.save(output_path)
    return output_path


def _write_header_row(ws, row, labels, start_col=1):
    for i, label in enumerate(labels):
        cell = ws.cell(row=row, column=start_col + i, value=label)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center")


def _write_row(ws, row, col, values, font=BLACK_FONT, fmt=None):
    for i, v in enumerate(values):
        cell = ws.cell(row=row, column=col + i, value=v)
        cell.font = font
        if fmt:
            cell.number_format = fmt


def _build_summary_sheet(wb, dcf_result, assumptions):
    ws = wb.active
    ws.title = "Summary"
    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["B"].width = 18
    
    # Title
    ws.cell(row=1, column=1, value=f"{assumptions.get('company', '')} ({assumptions.get('ticker', '')}) — DCF Summary")
    ws.cell(row=1, column=1).font = Font(name="Calibri", size=14, bold=True)
    
    # Key outputs (green)
    r = 3
    for label, key, fmt in [
        ("Fair Value per Share", "fair_value_per_share", DOLLAR_FMT),
        ("Current Price", "current_price", DOLLAR_FMT),
        ("Upside / Downside", "gap_pct", "0.0%"),
        ("Enterprise Value ($M)", "enterprise_value", NUM_FMT),
        ("Equity Value ($M)", "equity_value", NUM_FMT),
    ]:
        ws.cell(row=r, column=1, value=label).font = SECTION_FONT
        val = dcf_result.get(key)
        if key == "gap_pct" and val is not None:
            val = val / 100
        cell = ws.cell(row=r, column=2, value=val)
        cell.font = GREEN_FONT
        cell.number_format = fmt
        r += 1
    
    # Key assumptions (blue = input)
    r += 1
    ws.cell(row=r, column=1, value="Key Assumptions").font = Font(name="Calibri", size=12, bold=True)
    r += 1
    assumptions_list = [
        ("WACC", assumptions.get("wacc"), PCT_FMT),
        ("Terminal Growth", assumptions.get("terminal_growth"), PCT_FMT),
        ("Projection Years", assumptions.get("projection_years"), "0"),
        ("Shares Outstanding", assumptions.get("shares_outstanding"), "#,##0"),
        ("Net Cash ($M)", assumptions.get("net_cash"), NUM_FMT),
    ]
    gm = assumptions.get("gross_margin")
    if isinstance(gm, dict):
        assumptions_list.append(("Gross Margin", gm.get("value"), PCT_FMT))
    
    for label, val, fmt in assumptions_list:
        ws.cell(row=r, column=1, value=label).font = BLACK_FONT
        cell = ws.cell(row=r, column=2, value=val)
        cell.font = BLUE_FONT
        cell.number_format = fmt
        r += 1
    
    # Sell-side anchor if present
    anchor = dcf_result.get("sell_side_anchor")
    if anchor:
        r += 1
        ws.cell(row=r, column=1, value=f"Sell-Side Anchor ({anchor.get('source', '?')})").font = Font(name="Calibri", size=12, bold=True)
        r += 1
        for k, v in anchor.items():
            if k == "source":
                continue
            ws.cell(row=r, column=1, value=k).font = BLACK_FONT
            ws.cell(row=r, column=2, value=v).font = Font(name="Calibri", size=10, color="996600")
            r += 1


def _build_pl_sheet(wb, yby, assumptions, n_years):
    ws = wb.create_sheet("P&L")
    ws.column_dimensions["A"].width = 24
    
    # Header row: blank | Y1 | Y2 | ...
    headers = [""] + [f"Y{row['year']}" for row in yby]
    _write_header_row(ws, 1, headers)
    for i in range(1, len(headers)):
        ws.column_dimensions[get_column_letter(i + 1)].width = 16
    
    # Revenue (input — blue)
    rows_data = [
        ("Revenue ($M)", [r["revenue"] for r in yby], BLUE_FONT, NUM_FMT),
        ("Revenue Growth", [r["revenue_growth"] for r in yby], BLACK_FONT, PCT_FMT),
        ("COGS ($M)", [r.get("cogs", r["revenue"] - r["gross_profit"]) for r in yby], BLACK_FONT, NUM_FMT),
        ("Gross Profit ($M)", [r["gross_profit"] for r in yby], BLACK_FONT, NUM_FMT),
        ("Total OpEx ($M)", [r.get("total_opex", r["gross_profit"] - r["ebit"]) for r in yby], BLACK_FONT, NUM_FMT),
        ("EBIT ($M)", [r["ebit"] for r in yby], SECTION_FONT, NUM_FMT),
        ("NOPAT ($M)", [r["nopat"] for r in yby], BLACK_FONT, NUM_FMT),
    ]
    
    # Optional detail rows
    if yby and "sga" in yby[0]:
        rows_data.insert(4, ("SG&A ($M)", [r.get("sga", 0) for r in yby], BLACK_FONT, NUM_FMT))
        rows_data.insert(5, ("R&D ($M)", [r.get("rd", 0) for r in yby], BLACK_FONT, NUM_FMT))
    
    r = 2
    for label, values, font, fmt in rows_data:
        ws.cell(row=r, column=1, value=label).font = SECTION_FONT
        _write_row(ws, r, 2, values, font, fmt)
        r += 1
    
    # Add formulas for Gross Margin %
    r += 1
    ws.cell(row=r, column=1, value="Gross Margin %").font = BLACK_FONT
    for i in range(n_years):
        col_letter = get_column_letter(i + 2)
        # Formula references the revenue and gross profit rows
        cell = ws.cell(row=r, column=i + 2,
                       value=f"={col_letter}5/{col_letter}2" if n_years > 0 else 0)
        cell.font = BLACK_FONT
        cell.number_format = PCT_FMT


def _build_dcf_sheet(wb, dcf_result, assumptions, n_years):
    ws = wb.create_sheet("DCF")
    ws.column_dimensions["A"].width = 24
    
    yby = dcf_result.get("year_by_year", [])
    headers = [""] + [f"Y{row['year']}" for row in yby] + ["Terminal"]
    _write_header_row(ws, 1, headers)
    for i in range(1, len(headers)):
        ws.column_dimensions[get_column_letter(i + 1)].width = 16
    
    rows_data = [
        ("NOPAT ($M)", [r["nopat"] for r in yby]),
        ("+ D&A ($M)", [r["da"] for r in yby]),
        ("- CapEx ($M)", [r.get("capex", 0) for r in yby]),
        ("- ΔWC ($M)", [r.get("delta_wc", r.get("nwc", 0)) for r in yby]),
        ("= FCF ($M)", [r["fcf"] for r in yby]),
        ("Discount Factor", [(1 + assumptions.get("wacc", 0.10)) ** (t + 1) for t in range(n_years)]),
        ("Discounted FCF ($M)", [r["discounted_fcf"] for r in yby]),
    ]
    
    r = 2
    for label, values in rows_data:
        ws.cell(row=r, column=1, value=label).font = SECTION_FONT
        is_fcf = label.startswith("= FCF")
        font = GREEN_FONT if is_fcf else BLACK_FONT
        _write_row(ws, r, 2, values, font, NUM_FMT)
        r += 1
    
    # Terminal value
    tv = dcf_result.get("terminal_value", 0)
    dtv = dcf_result.get("discounted_terminal_value", 0)
    r += 1
    ws.cell(row=r, column=1, value="Terminal Value ($M)").font = SECTION_FONT
    ws.cell(row=r, column=n_years + 2, value=tv).font = BLACK_FONT
    ws.cell(row=r, column=n_years + 2).number_format = NUM_FMT
    r += 1
    ws.cell(row=r, column=1, value="Discounted TV ($M)").font = SECTION_FONT
    ws.cell(row=r, column=n_years + 2, value=dtv).font = BLACK_FONT
    ws.cell(row=r, column=n_years + 2).number_format = NUM_FMT
    
    # Bridge to equity
    r += 2
    bridge = [
        ("Sum of Discounted FCF", sum(row["discounted_fcf"] for row in yby)),
        ("+ Discounted Terminal Value", dtv),
        ("= Enterprise Value ($M)", dcf_result.get("enterprise_value", 0)),
        ("+ Net Cash ($M)", assumptions.get("net_cash", 0)),
        ("= Equity Value ($M)", dcf_result.get("equity_value", 0)),
        ("÷ Shares Outstanding", assumptions.get("shares_outstanding", 0)),
        ("= Fair Value per Share", dcf_result.get("fair_value_per_share", 0)),
    ]
    for label, val in bridge:
        ws.cell(row=r, column=1, value=label).font = SECTION_FONT
        is_output = label.startswith("= Fair") or label.startswith("= Enterprise") or label.startswith("= Equity")
        cell = ws.cell(row=r, column=2, value=val)
        cell.font = GREEN_FONT if is_output else BLACK_FONT
        cell.number_format = DOLLAR_FMT if "Fair Value" in label else NUM_FMT
        r += 1
    
    # Add live formula: Fair Value = Equity Value * 1000000 / Shares
    ev_row = r - 3  # Equity Value row
    shares_row = r - 2  # Shares row
    fv_row = r - 1  # Fair Value row
    ws.cell(row=fv_row, column=2, value=f"=B{ev_row}*1000000/B{shares_row}")
    ws.cell(row=fv_row, column=2).font = GREEN_FONT
    ws.cell(row=fv_row, column=2).number_format = DOLLAR_FMT


def _build_sensitivity_sheet(wb, dcf_result):
    ws = wb.create_sheet("Sensitivity")
    sens = dcf_result.get("sensitivity", {})
    if not sens:
        ws.cell(row=1, column=1, value="No sensitivity data")
        return
    
    wacc_vals = sens.get("wacc_values", [])
    growth_vals = sens.get("growth_values", [])
    matrix = sens.get("matrix", [])
    
    ws.column_dimensions["A"].width = 14
    
    # Title
    ws.cell(row=1, column=1, value="Fair Value Sensitivity: WACC vs Terminal Growth")
    ws.cell(row=1, column=1).font = Font(name="Calibri", size=12, bold=True)
    
    # Column headers (terminal growth)
    ws.cell(row=3, column=1, value="WACC \\ TG").font = HEADER_FONT
    ws.cell(row=3, column=1).fill = HEADER_FILL
    for j, g in enumerate(growth_vals):
        cell = ws.cell(row=3, column=j + 2, value=g)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.number_format = PCT_FMT
        ws.column_dimensions[get_column_letter(j + 2)].width = 14
    
    # Data rows
    mid_r = len(wacc_vals) // 2
    mid_c = len(growth_vals) // 2
    for i, w in enumerate(wacc_vals):
        cell = ws.cell(row=4 + i, column=1, value=w)
        cell.font = SECTION_FONT
        cell.number_format = PCT_FMT
        for j in range(len(growth_vals)):
            val = matrix[i][j] if i < len(matrix) and j < len(matrix[i]) else None
            cell = ws.cell(row=4 + i, column=j + 2, value=val)
            cell.number_format = DOLLAR_FMT
            if i == mid_r and j == mid_c:
                cell.font = GREEN_FONT
                cell.fill = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
            else:
                cell.font = BLACK_FONT


def _build_comps_sheet(wb, comps_data):
    ws = wb.create_sheet("Comps")
    peers = comps_data.get("peers", [])
    if not peers:
        ws.cell(row=1, column=1, value="No comps data")
        return
    
    headers = ["Ticker", "Market Cap ($M)", "Fwd P/E", "EV/EBITDA", "Rev Growth", "Gross Margin", "Target?"]
    _write_header_row(ws, 1, headers)
    ws.column_dimensions["A"].width = 12
    for i in range(2, 8):
        ws.column_dimensions[get_column_letter(i)].width = 16
    
    for i, p in enumerate(peers):
        r = i + 2
        ws.cell(row=r, column=1, value=p.get("ticker", "")).font = SECTION_FONT
        ws.cell(row=r, column=2, value=p.get("market_cap")).number_format = NUM_FMT
        ws.cell(row=r, column=3, value=p.get("fwd_pe")).number_format = "0.0x"
        ws.cell(row=r, column=4, value=p.get("ev_ebitda")).number_format = "0.0x"
        ws.cell(row=r, column=5, value=p.get("revenue_growth")).number_format = PCT_FMT
        ws.cell(row=r, column=6, value=p.get("gross_margin")).number_format = PCT_FMT
        is_target = p.get("is_target", False)
        ws.cell(row=r, column=7, value="✓" if is_target else "")
        if is_target:
            for c in range(1, 8):
                ws.cell(row=r, column=c).fill = LIGHT_FILL
```

- [ ] **Step 4: Run tests**

Run: `cd iris && python -m pytest tests/test_excel_export.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add iris/skills/dcf/excel_export.py iris/tests/test_excel_export.py
git commit -m "feat(dcf): add Excel export with live formulas and IB formatting"
```

### Task 7: Wire Excel export into valuation tool + API endpoint

**Files:**
- Modify: `iris/skills/valuation/tools.py`
- Modify: `iris/backend/api.py`

- [ ] **Step 1: Add `export_excel` mode to valuation tool**

In `iris/skills/valuation/tools.py`, update VALUATION_SCHEMA:

```python
"mode": {
    "type": "string",
    "enum": ["dcf", "comps", "full", "export_excel"],
    "description": "...'export_excel': generate Excel workbook from last DCF result.",
},
```

In `valuation()` function, first update the mode validation set:

```python
    if mode not in {"dcf", "comps", "full", "export_excel"}:
```

Then add the export_excel handler before the existing dcf/comps logic:

```python
    if mode == "export_excel":
        if not assumptions:
            return ToolResult.fail("assumptions required for export_excel")
        dcf_result = build_dcf(assumptions=assumptions)
        if dcf_result.status != "ok":
            return ToolResult.fail(_first_error(dcf_result, "DCF failed"))
        
        import tempfile, os
        from skills.dcf.excel_export import export_dcf_excel
        
        comps_data_for_excel = None
        if target and peers:
            comps_r = get_comps(ticker=target, peers=peers)
            if comps_r.status == "ok":
                comps_data_for_excel = comps_r.data
        
        fd, path = tempfile.mkstemp(suffix=".xlsx", prefix=f"dcf_{target}_")
        os.close(fd)
        export_dcf_excel(dcf_result.data, assumptions, path, comps_data_for_excel)
        
        return ToolResult.ok({
            "mode": "export_excel",
            "ticker": target,
            "excel_path": path,
            "fair_value_per_share": dcf_result.data.get("fair_value_per_share"),
            **dcf_result.data,  # include full DCF data too
        })
```

- [ ] **Step 2: Add Excel download endpoint to api.py**

Add to `iris/backend/api.py`:

```python
from fastapi.responses import FileResponse

@app.get("/api/analyze/{analysis_id}/excel")
async def download_excel(analysis_id: str):
    """Download the DCF Excel workbook for a completed analysis."""
    session = _sessions.get(analysis_id)
    if not session:
        # Try to find from DB
        row = db.execute(
            "SELECT excel_path FROM analysis_runs WHERE id = ?", (analysis_id,)
        ).fetchone()
        if not row or not row[0]:
            raise HTTPException(404, "No Excel file for this analysis")
        path = row[0]
    else:
        path = getattr(session, "excel_path", None)
        if not path:
            raise HTTPException(404, "No Excel file generated yet")
    
    if not os.path.exists(path):
        raise HTTPException(404, "Excel file not found on disk")
    
    ticker = analysis_id[:8]  # fallback name
    return FileResponse(path, filename=f"DCF_{ticker}.xlsx",
                       media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
```

- [ ] **Step 3: Verify endpoint responds**

Run: `cd iris && python -c "from backend.api import app; print('API loaded OK')"`
Expected: "API loaded OK"

- [ ] **Step 4: Commit**

```bash
git add iris/skills/valuation/tools.py iris/backend/api.py
git commit -m "feat(valuation): wire Excel export mode and download endpoint"
```

---

## Chunk 4: Frontend — Expanded Display + Excel Download

### Task 8: Expand TypeScript types

**Files:**
- Modify: `iris-frontend/src/types/analysis.ts`

- [ ] **Step 1: Add new fields to ModelPanelState**

```typescript
export interface ModelPanelState {
  fairValue: FairValueData | null;
  assumptions: DCFAssumption[];
  impliedMultiples: { label: string; value: string | number }[];
  sensitivityData: SensitivityCell[];
  sensitivityRowLabel: string;
  sensitivityColLabel: string;
  sensitivityRowValues: string[];
  sensitivityColValues: string[];
  yearByYear: YearProjection[];
  crossCheck: CrossCheckResult | null;  // was Record<string, unknown>
  warnings: string[];                    // was optional
  sellSideAnchor: SellSideAnchor | null; // NEW
  excelPath: string | null;              // NEW
  loading: boolean;
}

export interface CrossCheckResult {
  status: "aligned" | "stretched" | "conservative" | "insufficient_data";
  message: string;
  implied_fwd_pe?: number;
  peer_median_fwd_pe?: number;
  premium_vs_peers?: number;
}

export interface SellSideAnchor {
  source: string;
  y1_revenue_growth?: number;
  gross_margin?: number;
  wacc?: number;
  target_price?: number;
}
```

Also expand `YearProjection` to include optional three-statement fields:

```typescript
export interface YearProjection {
  year: string;
  revenue: number;
  growth: number;
  ebitda: number;
  margin: number;
  fcf: number;
  // Optional three-statement detail
  cogs?: number;
  grossProfit?: number;
  sga?: number;
  rd?: number;
  nopat?: number;
  da?: number;
  capex?: number;
  nwc?: number;
  deltaWc?: number;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd iris-frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Errors from components not yet updated (that's fine)

- [ ] **Step 3: Commit**

```bash
git add iris-frontend/src/types/analysis.ts
git commit -m "feat(types): expand ModelPanelState with cross-check, sell-side anchor, excel path"
```

### Task 9: Create WarningsBanner and CrossCheckBadge components

**Files:**
- Create: `iris-frontend/src/components/WarningsBanner.tsx`
- Create: `iris-frontend/src/components/CrossCheckBadge.tsx`

- [ ] **Step 1: Create WarningsBanner**

```typescript
"use client";

interface WarningsBannerProps {
  warnings: string[];
}

export function WarningsBanner({ warnings }: WarningsBannerProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.05)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#B45309]">
        DCF Warnings
      </div>
      <ul className="mt-2 space-y-1">
        {warnings.map((w, i) => (
          <li key={i} className="text-[12px] leading-[1.6] text-[#92400E]">
            • {w}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create CrossCheckBadge**

```typescript
"use client";

import type { CrossCheckResult } from "@/types/analysis";

interface CrossCheckBadgeProps {
  data: CrossCheckResult;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  aligned: { bg: "rgba(21,128,61,0.08)", text: "var(--green)", label: "DCF ≈ Peers" },
  stretched: { bg: "rgba(185,28,28,0.08)", text: "var(--red)", label: "DCF > Peers" },
  conservative: { bg: "rgba(245,158,11,0.08)", text: "#B45309", label: "DCF < Peers" },
  insufficient_data: { bg: "var(--bg-2)", text: "var(--t3)", label: "对比数据不足" },
};

export function CrossCheckBadge({ data }: CrossCheckBadgeProps) {
  const style = STATUS_STYLES[data.status] || STATUS_STYLES.insufficient_data;

  return (
    <div className="prism-panel p-4" style={{ background: style.bg }}>
      <div className="flex items-center gap-3">
        <span
          className="rounded-pill px-3 py-1 text-[11px] font-semibold"
          style={{ color: style.text, background: `${style.bg}` }}
        >
          {style.label}
        </span>
        <span className="text-[12px] text-[var(--t2)]">{data.message}</span>
      </div>
      {data.implied_fwd_pe != null && data.peer_median_fwd_pe != null && (
        <div className="mt-2 flex gap-4 font-mono text-[11px] text-[var(--t3)]">
          <span>DCF Implied P/E: {data.implied_fwd_pe?.toFixed(1)}x</span>
          <span>Peer Median: {data.peer_median_fwd_pe?.toFixed(1)}x</span>
          <span>Premium: {((data.premium_vs_peers || 0) * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add iris-frontend/src/components/WarningsBanner.tsx iris-frontend/src/components/CrossCheckBadge.tsx
git commit -m "feat(ui): add WarningsBanner and CrossCheckBadge components"
```

### Task 10: Update ModelPanel to render new components + Excel download

**Files:**
- Modify: `iris-frontend/src/components/ModelPanel.tsx`

- [ ] **Step 1: Update ModelPanel**

```typescript
"use client";

import { useAnalysisStore } from "@/hooks/useAnalysisStore";
import { FairValueCard } from "./FairValueCard";
import { ImpliedMultiples } from "./ImpliedMultiples";
import { SensitivityHeatmap } from "./SensitivityHeatmap";
import { YearByYearTable } from "./YearByYearTable";
import { AssumptionList } from "./AssumptionList";
import { WarningsBanner } from "./WarningsBanner";
import { CrossCheckBadge } from "./CrossCheckBadge";

// ... LoadingSkeleton unchanged ...

export function ModelPanel() {
  const panel = useAnalysisStore((s) => s.modelPanel);
  const analysisId = useAnalysisStore((s) => s.analysisId);

  // ... loading/empty state unchanged ...

  return (
    <div className="space-y-5 p-5 sm:p-6">
      {panel.fairValue && <FairValueCard data={panel.fairValue} />}
      {panel.crossCheck && <CrossCheckBadge data={panel.crossCheck} />}
      {panel.warnings && panel.warnings.length > 0 && <WarningsBanner warnings={panel.warnings} />}
      {panel.impliedMultiples.length > 0 && <ImpliedMultiples multiples={panel.impliedMultiples} />}
      {panel.assumptions.length > 0 && <AssumptionList assumptions={panel.assumptions} />}
      {panel.yearByYear.length > 0 && <YearByYearTable data={panel.yearByYear} />}
      {panel.sensitivityData.length > 0 && (
        <SensitivityHeatmap
          data={panel.sensitivityData}
          rowLabel={panel.sensitivityRowLabel}
          colLabel={panel.sensitivityColLabel}
          rowValues={panel.sensitivityRowValues}
          colValues={panel.sensitivityColValues}
        />
      )}
      {panel.excelPath && analysisId && (
        <a
          href={`/api/analyze/${analysisId}/excel`}
          download
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--ac-m)] bg-[var(--ac-s)] px-4 py-3 text-[13px] font-medium text-[var(--ac)] transition-colors hover:bg-[var(--ac)] hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          下载 DCF Excel 模型
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd iris-frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: May have errors from store not yet updated — fix in next task

- [ ] **Step 3: Commit**

```bash
git add iris-frontend/src/components/ModelPanel.tsx
git commit -m "feat(ui): render warnings, cross-check, assumptions, Excel download in ModelPanel"
```

### Task 11: Update useAnalysisStore to extract expanded DCF output

**Files:**
- Modify: `iris-frontend/src/hooks/useAnalysisStore.ts`

- [ ] **Step 1: Update initialModelPanel**

Add new fields:

```typescript
const initialModelPanel: ModelPanelState = {
  fairValue: null,
  assumptions: [],
  impliedMultiples: [],
  sensitivityData: [],
  sensitivityRowLabel: "WACC",
  sensitivityColLabel: "Terminal Growth",
  sensitivityRowValues: [],
  sensitivityColValues: [],
  yearByYear: [],
  crossCheck: null,
  warnings: [],
  sellSideAnchor: null,
  excelPath: null,
  loading: false,
};
```

- [ ] **Step 2: Update _extractPanelData build_dcf case**

After existing extraction, add:

```typescript
    // Extract warnings
    const warnings = (result.warnings as string[]) || [];
    
    // Extract cross-check
    const crossCheck = result.cross_check as CrossCheckResult | undefined;
    
    // Extract sell-side anchor
    const sellSideAnchor = result.sell_side_anchor as SellSideAnchor | undefined;
    
    // Extract excel path
    const excelPath = result.excel_path as string | undefined;
    
    // Build assumptions for display
    const assumptions: DCFAssumption[] = [];
    if (result.assumptions || true) {
      // Extract key assumptions from the input that was passed through
      const wacc = result.wacc ?? result.assumptions?.wacc;
      const tg = result.terminal_growth ?? result.assumptions?.terminal_growth;
      if (wacc) assumptions.push({ label: "WACC", value: `${(wacc as number * 100).toFixed(1)}%` });
      if (tg) assumptions.push({ label: "Terminal Growth", value: `${(tg as number * 100).toFixed(1)}%` });
    }
```

Update the set() call to include new fields:

```typescript
    set((s) => ({
      modelPanel: {
        ...s.modelPanel,
        // ... existing fields ...
        warnings: warnings.length > 0 ? warnings : s.modelPanel.warnings,
        crossCheck: crossCheck ?? s.modelPanel.crossCheck,
        sellSideAnchor: sellSideAnchor ?? s.modelPanel.sellSideAnchor,
        excelPath: excelPath ?? s.modelPanel.excelPath,
        loading: false,
      },
    }));
```

- [ ] **Step 3: Also handle valuation tool result (which wraps build_dcf)**

In the `case "valuation":` handler, ensure cross_check and warnings are extracted from the top-level result:

```typescript
    case "valuation": {
      // Valuation wraps build_dcf + get_comps. Extract warnings and cross_check.
      if (result.warnings) {
        set((s) => ({
          modelPanel: { ...s.modelPanel, warnings: result.warnings as string[] },
        }));
      }
      if (result.cross_check) {
        set((s) => ({
          modelPanel: { ...s.modelPanel, crossCheck: result.cross_check as CrossCheckResult },
        }));
      }
      if (result.excel_path) {
        set((s) => ({
          modelPanel: { ...s.modelPanel, excelPath: result.excel_path as string },
        }));
      }
      // Delegate to build_dcf and get_comps extraction
      _extractPanelData("build_dcf", result, set);
      if (result.comps || result.peers) {
        _extractPanelData("get_comps", result, set);
      }
      break;
    }
```

- [ ] **Step 4: Verify compilation**

Run: `cd iris-frontend && npx tsc --noEmit --pretty`
Expected: PASS with 0 errors

- [ ] **Step 5: Commit**

```bash
git add iris-frontend/src/hooks/useAnalysisStore.ts
git commit -m "feat(store): extract warnings, cross-check, sell-side anchor, excel path from DCF result"
```

---

## Chunk 5: Document Parser Enhancement

### Task 12: Upgrade Excel parsing with formula extraction

**Files:**
- Modify: `iris/tools/document_parser.py`

- [ ] **Step 1: Write test for enhanced Excel parsing**

Create: `iris/tests/test_excel_parser.py`

```python
"""Tests for enhanced Excel parsing with formula and structure extraction."""
import pytest
from openpyxl import Workbook
from tools.document_parser import parse_file

def _make_test_xlsx(path, with_formulas=True):
    wb = Workbook()
    ws = wb.active
    ws.title = "DCF Model"
    ws["A1"] = "Revenue"
    ws["B1"] = 1000
    ws["C1"] = "=B1*1.1" if with_formulas else 1100
    ws["A2"] = "WACC"
    ws["B2"] = 0.10
    wb.save(str(path))

def test_excel_parse_returns_markdown(tmp_path):
    path = tmp_path / "test.xlsx"
    _make_test_xlsx(path, with_formulas=False)
    result = parse_file(path.read_bytes(), path.name)
    assert "Revenue" in result.content
    assert "1000" in result.content

def test_excel_parse_extracts_formulas(tmp_path):
    path = tmp_path / "test.xlsx"
    _make_test_xlsx(path, with_formulas=True)
    result = parse_file(path.read_bytes(), path.name)
    # Enhanced parser should note formula presence
    assert "formula" in result.content.lower() or "=B1*1.1" in result.content

def test_excel_parse_preserves_sheet_names(tmp_path):
    path = tmp_path / "test.xlsx"
    _make_test_xlsx(path)
    result = parse_file(path.read_bytes(), path.name)
    assert "DCF Model" in result.content
```

- [ ] **Step 2: Run tests**

Run: `cd iris && python -m pytest tests/test_excel_parser.py -v`
Expected: test_excel_parse_returns_markdown PASS, formula test FAIL

- [ ] **Step 3: Enhance _parse_excel in document_parser.py**

Enhance the existing `parse_excel` function (note: no underscore prefix) to add formula awareness. Keep the same signature `(file_bytes: bytes, filename: str, max_rows: int)`:

```python
def parse_excel(file_bytes: bytes, filename: str = "file.xlsx", max_rows: int = 2000) -> ParseResult:
    """Parse Excel with formula awareness using openpyxl + pandas fallback."""
    import io
    from openpyxl import load_workbook
    
    sections = []
    try:
        # First pass: openpyxl for structure + formulas
        wb = load_workbook(io.BytesIO(file_bytes), data_only=False)
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            sections.append(f"## Sheet: {sheet_name}\n")
            
            # Detect formula cells
            formula_cells = []
            rows_data = []
            for row in ws.iter_rows(values_only=False):
                row_vals = []
                for cell in row:
                    if isinstance(cell.value, str) and cell.value.startswith("="):
                        formula_cells.append(f"{cell.coordinate}: `{cell.value}`")
                        row_vals.append(f"{cell.value}")
                    else:
                        row_vals.append(str(cell.value) if cell.value is not None else "")
                rows_data.append(row_vals)
            
            # Build markdown table
            if rows_data:
                # Use first row as header
                header = "| " + " | ".join(rows_data[0]) + " |"
                sep = "| " + " | ".join(["---"] * len(rows_data[0])) + " |"
                body = "\n".join("| " + " | ".join(r) + " |" for r in rows_data[1:])
                sections.append(f"{header}\n{sep}\n{body}\n")
            
            # Append formula summary
            if formula_cells:
                sections.append(f"\n**Formulas in {sheet_name}:**\n")
                for fc in formula_cells[:20]:  # cap at 20 formulas
                    sections.append(f"- {fc}")
                sections.append("")
        
        content = "\n".join(sections)
        return ParseResult(
            content=content,
            engine_used="openpyxl",
            page_count=len(wb.sheetnames),
            metadata={"sheets": wb.sheetnames},
        )
    except Exception:
        # Fallback to existing pandas-based parsing
        import pandas as pd
        ext = Path(filename).suffix.lower()
        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(file_bytes), nrows=max_rows)
            sheets = {"Sheet1": df}
        else:
            sheets = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None, nrows=max_rows)
        parts = []
        for name, df in sheets.items():
            parts.append(f"## Sheet: {name}\n\n{df.to_markdown(index=False)}\n")
        return ParseResult(content="\n".join(parts), engine_used="pandas",
                          page_count=len(sheets), metadata={})
```

- [ ] **Step 4: Run tests**

Run: `cd iris && python -m pytest tests/test_excel_parser.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add iris/tools/document_parser.py iris/tests/test_excel_parser.py
git commit -m "feat(parser): enhance Excel parsing with openpyxl formula extraction"
```

### Task 13: Make Docling default for PDF financial reports

**Files:**
- Modify: `iris/tools/document_parser.py`
- Modify: `iris/iris_config.yaml`

- [ ] **Step 1: Update config to prefer docling**

Add to `iris/iris_config.yaml` under `knowledge:`:

```yaml
knowledge:
  chunk_size: 800
  chunk_overlap: 200
  pdf_engine: docling    # NEW: prefer docling for financial table accuracy
```

- [ ] **Step 2: Update parse_file to read config preference**

In `_parse_pdf`, check config for preferred engine:

```python
def _parse_pdf(path: str, engine: ParseEngine = ParseEngine.AUTO) -> ParseResult:
    if engine == ParseEngine.AUTO:
        from core.config import load_config
        cfg = load_config()
        preferred = cfg.get("knowledge", {}).get("pdf_engine", "pymupdf")
        if preferred == "docling":
            engine = ParseEngine.DOCLING
        else:
            engine = ParseEngine.PYMUPDF
    # ... rest unchanged
```

- [ ] **Step 3: Commit**

```bash
git add iris/tools/document_parser.py iris/iris_config.yaml
git commit -m "feat(parser): make docling default PDF engine for better financial table extraction"
```

---

## Chunk 6: Config + Final Integration

### Task 14: Update dcf config.yaml with new defaults

**Files:**
- Modify: `iris/skills/dcf/config.yaml`

- [ ] **Step 1: Add new config entries**

```yaml
max_projection_years: 10
terminal_growth_max: 0.04
wacc_range: [0.05, 0.20]
comps_outlier_threshold: 0.50
sensitivity:
  wacc_steps: [-0.02, -0.01, 0, 0.01, 0.02]
  growth_steps: [-0.01, -0.005, 0, 0.005, 0.01]

# Three-statement defaults (used when LLM doesn't provide explicit values)
bs_defaults:
  days_receivable: 45
  days_inventory: 30
  days_payable: 35
  sbc_pct: 0.02

# Excel export
excel:
  enabled: true
  auto_export: false  # if true, every DCF run also generates Excel
```

- [ ] **Step 2: Commit**

```bash
git add iris/skills/dcf/config.yaml
git commit -m "config(dcf): add three-statement defaults and Excel export settings"
```

### Task 15: Run full test suite

- [ ] **Step 1: Run all backend tests**

Run: `cd iris && python -m pytest tests/ -v --tb=short`
Expected: ALL PASS

- [ ] **Step 2: Run frontend type check**

Run: `cd iris-frontend && npx tsc --noEmit --pretty`
Expected: 0 errors

- [ ] **Step 3: Final commit with all remaining files**

```bash
git add -A
git commit -m "feat(valuation): complete skill upgrade — three-statement, Excel export, sell-side comparison"
```
