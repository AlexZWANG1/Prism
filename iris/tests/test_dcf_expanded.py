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
    yby = result.data["year_by_year"]
    # Should have NWC-related fields when days provided
    assert "nwc" in yby[0]
    assert "sga" in yby[0]
    assert "rd" in yby[0]


def test_expanded_output_has_three_statement_fields():
    """With expanded inputs, output includes detailed NWC breakdown."""
    expanded = {**BASE_ASSUMPTIONS,
        "days_receivable": {"value": 45},
        "days_inventory": {"value": 30},
        "days_payable": {"value": 40},
    }
    result = build_dcf(expanded)
    assert result.status == "ok"
    yby = result.data["year_by_year"][0]
    assert "nwc" in yby
    assert "delta_wc" in yby
    assert "accounts_receivable" in yby
    assert "inventory" in yby
    assert "accounts_payable" in yby


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


def test_backward_compat_no_new_fields():
    """Base assumptions produce output WITHOUT new BS detail fields."""
    result = build_dcf(BASE_ASSUMPTIONS)
    assert result.status == "ok"
    yby = result.data["year_by_year"][0]
    # Should still have basic fields
    assert "revenue" in yby
    assert "fcf" in yby
    assert "nwc" in yby  # simplified NWC always present
    assert "delta_wc" in yby
    # Should NOT have detailed BS fields
    assert "accounts_receivable" not in yby


def test_output_consistency_with_and_without_detail():
    """Both paths produce a valid fair value (may differ due to WC method)."""
    simple = build_dcf(BASE_ASSUMPTIONS)
    expanded = build_dcf({**BASE_ASSUMPTIONS,
        "days_receivable": {"value": 45},
        "days_inventory": {"value": 30},
        "days_payable": {"value": 40},
    })
    assert simple.status == "ok"
    assert expanded.status == "ok"
    # Both should produce positive fair values
    assert simple.data["fair_value_per_share"] > 0
    assert expanded.data["fair_value_per_share"] > 0
