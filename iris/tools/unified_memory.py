"""
IRIS Unified Memory System — remember and recall tools.

Simple two-tool interface: remember (write) and recall (read).
All AI memory stored as "notes" in a single knowledge_items table.
"""

import json
import uuid
from datetime import datetime, date, timezone
from pathlib import Path

from core.config import get as config_get, get_skill_config
from tools.base import Tool, ToolResult, make_tool_schema
from tools.retrieval import EvidenceRetriever


# ── Schemas ──────────────────────────────────────────────────

REMEMBER_SCHEMA = make_tool_schema(
    name="remember",
    description=(
        "写一条投资笔记。好的笔记记录你的思考过程：看到了什么数据/事实、"
        "推理出了什么结论、对未来分析有什么指导意义。"
        "至少写 2-3 句有实质内容的话，不要只存一句碎片。"
    ),
    properties={
        "subject": {
            "type": "string",
            "description": "Company ticker or topic (e.g. 'NVDA', 'semiconductors')",
        },
        "content": {
            "type": "string",
            "description": (
                "投资笔记正文。应包含：(1) 关键数据或事实 (2) 你的推理和判断 "
                "(3) 对未来分析的启示。用自然语言写，像分析师的研究笔记。"
            ),
        },
        "tags": {
            "type": "array",
            "items": {"type": "string"},
            "description": "标签，如 ['earnings', 'valuation', 'capex', 'warning']",
        },
        "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Confidence level (0-1)",
        },
        "source": {
            "type": "string",
            "description": "数据来源，如 'FY2026 Q1 earnings release' 或 tool/analysis run ID",
        },
    },
    required=["subject", "content"],
)


RECALL_SCHEMA = make_tool_schema(
    name="recall",
    description=(
        "检索你之前写过的投资笔记。按 subject 精确匹配 + 语义搜索。"
        "不搜索用户上传的文档（用 search_knowledge）。"
    ),
    properties={
        "subject": {
            "type": "string",
            "description": "Company ticker or topic to focus on",
        },
        "context": {
            "type": "string",
            "description": "What you're looking for — e.g. 'NVDA capex assumptions for DCF'",
        },
    },
    required=["context"],
)


SEARCH_KNOWLEDGE_SCHEMA = make_tool_schema(
    name="search_knowledge",
    description=(
        "Search the user-uploaded knowledge base — research reports, articles, notes, "
        "and documents the user has added. Returns relevant passages with source citations."
    ),
    properties={
        "query": {
            "type": "string",
            "description": "Natural language search query, e.g. 'NVDA data center revenue drivers'",
        },
        "top_k": {
            "type": "integer",
            "description": "Max results to return. Default 5.",
        },
        "company": {
            "type": "string",
            "description": "Optional: filter by company ticker",
        },
    },
    required=["query"],
)


# ── remember implementation ──────────────────────────────────

_MIN_CONTENT_LENGTH = 50  # reject one-liner fragments


def remember(
    retriever: EvidenceRetriever,
    content: str,
    subject: str = "",
    confidence: float = None,
    source: str = "",
    tags: list = None,
    # Legacy params — accepted but ignored for backward compat
    type: str = None,
    zone: str = None,
    level: str = None,
    methodology: dict = None,
    evidence: list = None,
    note_category: str = None,
    metric: str = None,
    predicted: float = None,
) -> ToolResult:
    """Save an investment research note to AI memory."""

    # Quality gate: reject fragments
    if len(content.strip()) < _MIN_CONTENT_LENGTH:
        return ToolResult.fail(
            "笔记内容太短，至少写 2-3 句话。",
            hint="好的笔记应包含数据/事实、推理过程、和结论。不要只存一句碎片。",
        )

    # Track source usefulness
    if source:
        _track_source_useful(retriever, source)

    # Dedup: check for similar existing notes via embedding search
    best_match = None
    best_sim = 0.0
    dup_threshold = 0.90
    merge_threshold = 0.70
    try:
        search_query = f"{subject}: {content}" if subject else content
        search_results = retriever.semantic_search(search_query, top_k=5)
        for sr in search_results:
            item = retriever.get_knowledge_item(sr["id"])
            if item and sr["score"] > best_sim:
                best_sim = sr["score"]
                best_match = item
    except Exception:
        pass  # dedup is best-effort

    # Duplicate — skip
    if best_sim >= dup_threshold and best_match:
        return ToolResult.ok({
            "action": "deduplicated",
            "existing_id": best_match["id"],
            "message": f"Already exists (similarity {best_sim:.2f}). Not saved.",
        })

    # Similar — merge (keep richer content)
    if best_sim >= merge_threshold and best_match:
        if len(content) > len(best_match.get("content", "")):
            now = datetime.now(timezone.utc).isoformat()
            with retriever._conn() as conn:
                conn.execute(
                    "UPDATE knowledge_items SET content = ?, updated_at = ? WHERE id = ?",
                    (content, now, best_match["id"]),
                )
            retriever.save_embedding(best_match["id"], f"{subject}: {content}", "note")
        return ToolResult.ok({
            "action": "merged",
            "existing_id": best_match["id"],
            "message": f"Merged with similar note (similarity {best_sim:.2f}).",
        })

    # Novel — insert
    item_id = retriever.save_knowledge_item(
        type="note",
        subject=(subject or "").upper(),
        content=content,
        structured_data={},
        confidence=confidence,
        source=source,
        tags=tags,
    )

    return ToolResult.ok({
        "action": "saved",
        "id": item_id,
        "subject": (subject or "").upper(),
        "message": "投资笔记已保存。",
    })


# ── recall implementation ────────────────────────────────────

def recall(
    retriever: EvidenceRetriever,
    context: str,
    subject: str = "",
    # Legacy param — accepted but ignored
    types: list = None,
) -> ToolResult:
    """Search AI memory for relevant notes. Returns a flat list."""

    notes: list[dict] = []
    seen_ids: set[str] = set()

    # 1. Direct query by subject
    if subject:
        items = retriever.query_knowledge_items(subject=subject, limit=20)
        for item in items:
            notes.append(_format_note(item))
            seen_ids.add(item["id"])

    # 2. Semantic search for broader matches
    search_query = f"{subject}: {context}" if subject else context
    try:
        search_hits = retriever.semantic_search(search_query, top_k=10)
    except Exception:
        search_hits = []

    for hit in search_hits:
        if hit["id"] in seen_ids:
            continue
        item = retriever.get_knowledge_item(hit["id"])
        if item:
            notes.append(_format_note(item))
            seen_ids.add(hit["id"])

    # 3. Also check hypotheses (from legacy table)
    if subject:
        try:
            hyps = retriever.list_hypotheses(company=subject)
            for h in hyps:
                if h.id not in seen_ids:
                    notes.append({
                        "id": h.id,
                        "subject": h.company,
                        "content": h.thesis,
                        "confidence": h.confidence,
                        "source": "hypothesis",
                        "created_at": None,
                    })
                    seen_ids.add(h.id)
        except Exception:
            pass

    return ToolResult.ok({
        "notes": notes,
        "total": len(notes),
    })


def search_knowledge(
    retriever: EvidenceRetriever,
    query: str,
    top_k: int = 5,
    company: str = None,
) -> ToolResult:
    """Search user-uploaded knowledge base (reports, articles, notes)."""
    try:
        hits = retriever.semantic_search(
            query=query,
            top_k=top_k,
            source_category="human_knowledge",
        )
    except Exception:
        hits = []

    # Filter by company if specified
    if company:
        company_upper = company.upper()
        hits = [h for h in hits if company_upper in (h.get("content", "") + h.get("document_title", "")).upper()]

    results = []
    for hit in hits:
        results.append({
            "id": hit.get("id", ""),
            "content": hit.get("content", ""),
            "document_title": hit.get("document_title", ""),
            "document_id": hit.get("document_id", ""),
            "score": hit.get("score", 0),
        })

    return ToolResult.ok({
        "query": query,
        "results": results,
        "count": len(results),
    })


# ── Helpers ───────────────────────────────────────────────────

def _format_note(item: dict) -> dict:
    """Format a knowledge_item as a flat note entry."""
    return {
        "id": item["id"],
        "subject": item.get("subject", ""),
        "content": item.get("content", ""),
        "confidence": item.get("confidence"),
        "source": item.get("source", ""),
        "tags": item.get("tags", []),
        "created_at": item.get("created_at"),
    }


def _track_source_useful(retriever, source: str):
    """If source references an existing knowledge_item ID, increment its times_useful."""
    if not source or not hasattr(retriever, "get_knowledge_item"):
        return
    try:
        item = retriever.get_knowledge_item(source)
        if item:
            sd = item.get("structured_data", {})
            sd["times_useful"] = sd.get("times_useful", 0) + 1
            retriever.update_knowledge_item_structured_data(source, sd)
    except Exception:
        pass


# ── Auto-recall for context injection ─────────────────────────

def auto_recall_for_context(retriever, subject: str) -> list[dict] | None:
    """Return recent notes for a subject, used by ContextAssembler."""
    if not subject or not hasattr(retriever, "query_knowledge_items"):
        return None

    items = retriever.query_knowledge_items(subject=subject, limit=10)
    if not items:
        return None

    return [_format_note(item) for item in items]
