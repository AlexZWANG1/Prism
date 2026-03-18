import os
import pytest
from dotenv import load_dotenv
load_dotenv()

pytestmark = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="Integration tests require OPENAI_API_KEY"
)


def test_full_pipeline_runs_without_crash(tmp_path):
    from main import build_harness
    harness, retriever = build_harness(str(tmp_path / "test.db"))
    result = harness.run(
        "Quick analysis: Is NVDA a buy? Keep it brief.",
        context_docs=["NVDA reported strong data center revenue growth in Q4 2025."]
    )
    assert result is not None
    assert isinstance(result.ok, bool)
    assert isinstance(result.tool_log, list)
