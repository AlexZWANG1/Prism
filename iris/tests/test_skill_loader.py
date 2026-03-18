"""Tests for core/skill_loader.py"""

import pytest
from pathlib import Path
from core.skill_loader import load_skills, SkillLoadError
from core.config import get_skill_config, reset_skill_configs


@pytest.fixture(autouse=True)
def clean_skill_configs():
    reset_skill_configs()
    yield
    reset_skill_configs()


def _write_file(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_empty_dir_returns_nothing(tmp_path):
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir()
    tools, soul = load_skills(str(skills_dir))
    assert tools == []
    assert soul == ""


def test_nonexistent_dir_returns_nothing(tmp_path):
    tools, soul = load_skills(str(tmp_path / "noexist"))
    assert tools == []
    assert soul == ""


def test_loads_skill_md(tmp_path):
    skills_dir = tmp_path / "skills"
    _write_file(skills_dir / "test_skill" / "SKILL.md", "# Test Skill\nDo things.")
    tools, soul = load_skills(str(skills_dir))
    assert tools == []
    assert "# Test Skill" in soul


def test_loads_config_yaml(tmp_path):
    skills_dir = tmp_path / "skills"
    _write_file(skills_dir / "test_skill" / "config.yaml", "key1: value1\nkey2: 42\n")
    _write_file(skills_dir / "test_skill" / "SKILL.md", "# Test")
    load_skills(str(skills_dir))
    assert get_skill_config("test_skill", "key1") == "value1"
    assert get_skill_config("test_skill", "key2") == 42
    assert get_skill_config("test_skill", "missing", "default") == "default"


def test_loads_tools_via_register(tmp_path):
    skills_dir = tmp_path / "skills"
    tools_code = '''
from tools.base import Tool, ToolResult, make_tool_schema

def dummy_tool(x: str = "hello") -> ToolResult:
    return ToolResult.ok({"x": x})

DUMMY_SCHEMA = make_tool_schema("dummy", "A dummy tool", {"x": {"type": "string"}}, [])

def register(context):
    return [Tool(dummy_tool, DUMMY_SCHEMA)]
'''
    _write_file(skills_dir / "test_skill" / "tools.py", tools_code)
    tools, soul = load_skills(str(skills_dir))
    assert len(tools) == 1
    assert tools[0].name == "dummy"


def test_loads_tools_via_static_list(tmp_path):
    skills_dir = tmp_path / "skills"
    tools_code = '''
from tools.base import Tool, ToolResult, make_tool_schema

def static_tool(x: str = "hello") -> ToolResult:
    return ToolResult.ok({"x": x})

STATIC_SCHEMA = make_tool_schema("static", "A static tool", {"x": {"type": "string"}}, [])
TOOLS = [Tool(static_tool, STATIC_SCHEMA)]
'''
    _write_file(skills_dir / "test_skill" / "tools.py", tools_code)
    tools, soul = load_skills(str(skills_dir))
    assert len(tools) == 1
    assert tools[0].name == "static"


def test_duplicate_tool_names_raises(tmp_path):
    skills_dir = tmp_path / "skills"
    tools_code = '''
from tools.base import Tool, ToolResult, make_tool_schema
def dup(x: str = "") -> ToolResult: return ToolResult.ok({})
SCHEMA = make_tool_schema("dup_tool", "dup", {}, [])
TOOLS = [Tool(dup, SCHEMA)]
'''
    _write_file(skills_dir / "skill_a" / "tools.py", tools_code)
    _write_file(skills_dir / "skill_b" / "tools.py", tools_code)
    with pytest.raises(SkillLoadError, match="Duplicate tool name"):
        load_skills(str(skills_dir))


def test_skips_hidden_dirs(tmp_path):
    skills_dir = tmp_path / "skills"
    _write_file(skills_dir / ".hidden" / "SKILL.md", "# Hidden")
    _write_file(skills_dir / "_internal" / "SKILL.md", "# Internal")
    _write_file(skills_dir / "visible" / "SKILL.md", "# Visible")
    tools, soul = load_skills(str(skills_dir))
    assert "# Visible" in soul
    assert "# Hidden" not in soul
    assert "# Internal" not in soul


def test_deterministic_load_order(tmp_path):
    skills_dir = tmp_path / "skills"
    _write_file(skills_dir / "zzz" / "SKILL.md", "# ZZZ")
    _write_file(skills_dir / "aaa" / "SKILL.md", "# AAA")
    tools, soul = load_skills(str(skills_dir))
    # AAA should come before ZZZ (sorted)
    assert soul.index("# AAA") < soul.index("# ZZZ")


def test_context_passed_to_register(tmp_path):
    skills_dir = tmp_path / "skills"
    tools_code = '''
from tools.base import Tool, ToolResult, make_tool_schema

def ctx_tool(x: str = "") -> ToolResult: return ToolResult.ok({})
SCHEMA = make_tool_schema("ctx_tool", "ctx", {}, [])

def register(context):
    assert "my_dep" in context
    return [Tool(ctx_tool, SCHEMA)]
'''
    _write_file(skills_dir / "test_skill" / "tools.py", tools_code)
    tools, _ = load_skills(str(skills_dir), context={"my_dep": "value"})
    assert len(tools) == 1
