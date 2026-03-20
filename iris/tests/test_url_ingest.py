import os
from unittest.mock import MagicMock, patch

import pytest

from tools.retrieval import SQLiteRetriever
from tools.url_ingest import ingest_url_document, normalize_url


@pytest.fixture
def retriever(tmp_path):
    with patch("tools.retrieval.Embedder") as mock_embedder:
        embedder = MagicMock()
        embedder.embed.return_value = [[0.01] * 8]
        embedder.model_id = "test:mock"
        mock_embedder.return_value = embedder
        yield SQLiteRetriever(str(tmp_path / "ingest.db"))


def test_normalize_url_removes_tracking_params():
    url = "https://example.com/path?a=1&utm_source=x&utm_campaign=y#section"
    assert normalize_url(url) == "https://example.com/path?a=1"


def test_ingest_url_document_from_page_html(retriever, monkeypatch):
    monkeypatch.setattr(
        "tools.url_ingest.extract_metadata_with_ai",
        lambda **kwargs: {
            "title": "Test Title from AI",
            "summary": "summary",
            "content_type": "article",
            "source_name": "example.com",
            "published_at": "2026-03-20T12:00:00+00:00",
            "tags": ["ai", "research"],
            "companies": ["NVDA"],
            "language": "en",
            "confidence": 0.9,
        },
    )

    html = """
    <html>
      <head>
        <title>Original HTML Title</title>
        <meta property="article:published_time" content="2026-03-01T10:00:00Z" />
      </head>
      <body>
        <article>
          <h1>Headline</h1>
          <p>This is a long enough body for ingestion.</p>
          <p>It references NVIDIA and broader semiconductor demand outlook.</p>
        </article>
      </body>
    </html>
    """

    result = ingest_url_document(
        retriever=retriever,
        url="https://example.com/post?utm_source=test",
        page_html=html,
        source_type="browser_extension",
        tags=["manual"],
    )

    assert result["status"] == "ingested"
    doc = result["document"]
    assert doc["source_type"] == "browser_extension"
    assert doc["canonical_url"] == "https://example.com/post"
    assert doc["source_name"] == "example.com"
    assert doc["published_at"] == "2026-03-20T12:00:00+00:00"
    assert "manual" in doc["tags"]
    assert "ai" in doc["tags"]
    assert doc["company"] == "NVDA"
    assert isinstance(doc["ai_metadata_json"], dict)


def test_ingest_url_document_detects_duplicate(retriever, monkeypatch):
    monkeypatch.setattr(
        "tools.url_ingest.extract_metadata_with_ai",
        lambda **kwargs: {
            "title": "Duplicate Case",
            "summary": "summary",
            "content_type": "article",
            "source_name": "example.com",
            "published_at": None,
            "tags": [],
            "companies": [],
            "language": "en",
            "confidence": 0.4,
        },
    )

    monkeypatch.setattr(
        "tools.url_ingest._fetch_content_from_url",
        lambda *args, **kwargs: {
            "ok": True,
            "content": "A long enough content body for duplicate detection and embedding generation.",
            "title": "Fetched Title",
            "published_at": None,
            "method": "mock_fetch",
            "meta": {},
        },
    )

    first = ingest_url_document(
        retriever=retriever,
        url="https://example.com/article?id=1&utm_source=a",
        source_type="manual_url",
    )
    assert first["status"] == "ingested"

    second = ingest_url_document(
        retriever=retriever,
        url="https://example.com/article?id=1&utm_campaign=b",
        source_type="manual_url",
    )
    assert second["status"] == "duplicate"
    assert second["duplicate_of"] == first["document"]["id"]


def test_ingest_url_document_invalid_url(retriever):
    result = ingest_url_document(retriever=retriever, url="not-a-url")
    assert result["status"] == "failed"
    assert result["error"] == "invalid_url"
