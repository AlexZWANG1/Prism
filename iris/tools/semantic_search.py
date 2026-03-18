"""
Core semantic search tool — searches across all stored observations and hypotheses.

This is a core tool (not a skill) because it provides cross-skill semantic search.
"""

from core.config import get as config_get
from tools.base import ToolResult, make_tool_schema
from tools.retrieval import EvidenceRetriever


MEMORY_SEARCH_SCHEMA = make_tool_schema(
    name="memory_search",
    description=(
        "Semantic search across all saved observations, hypotheses, and evidence. "
        "Use when you need to recall prior analysis, check if something was already researched, "
        "or find related information across companies. Returns ranked results by relevance."
    ),
    properties={
        "query": {"type": "string", "description": "Natural language search query"},
        "top_k": {"type": "integer", "description": "Max results to return. Default 5."},
        "source_type": {
            "type": "string",
            "enum": ["observation", "hypothesis"],
            "description": "Filter by type. Omit to search all.",
        },
    },
    required=["query"],
)


def memory_search(
    retriever: EvidenceRetriever,
    query: str,
    top_k: int = 5,
    source_type: str = None,
) -> ToolResult:
    vector_enabled = config_get("vector_search.enabled", True)
    effective_top_k = top_k or config_get("vector_search.top_k", 5)

    if vector_enabled and hasattr(retriever, "semantic_search"):
        results = retriever.semantic_search(query, top_k=effective_top_k, source_type=source_type)
    else:
        # Fallback: keyword scan over stored observations/hypotheses.
        q = (query or "").lower()
        results = []
        if source_type in (None, "observation"):
            for o in retriever.query_observations():
                text = f"{o.subject} {o.claim} {o.source}".lower()
                if q in text:
                    results.append({
                        "id": o.id,
                        "content": f"{o.subject}: {o.claim}",
                        "source_type": "observation",
                        "score": 1.0,
                    })
        if source_type in (None, "hypothesis"):
            for h in retriever.list_hypotheses():
                text = f"{h.company} {h.thesis}".lower()
                if q in text:
                    results.append({
                        "id": h.id,
                        "content": f"{h.company}: {h.thesis}",
                        "source_type": "hypothesis",
                        "score": 1.0,
                    })
        results = results[:effective_top_k]

    return ToolResult.ok({
        "query": query,
        "results": results,
        "count": len(results),
        "vector_search_enabled": vector_enabled,
    })
