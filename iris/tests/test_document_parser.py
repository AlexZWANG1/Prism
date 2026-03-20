"""Tests for the multi-engine document parser."""

import pytest
from tools.document_parser import (
    ParseEngine,
    ParseResult,
    parse_file,
    parse_pdf,
    parse_excel,
    available_engines,
    PDF_EXTENSIONS,
    EXCEL_EXTENSIONS,
    TEXT_EXTENSIONS,
)


class TestAvailableEngines:
    def test_returns_list(self):
        engines = available_engines()
        assert isinstance(engines, list)

    def test_at_least_one_engine(self):
        engines = available_engines()
        assert len(engines) > 0


class TestParseFile:
    def test_text_file(self):
        content = b"Hello world\n\nSecond paragraph"
        result = parse_file(content, "test.txt")
        assert result.engine_used == "text"
        assert "Hello world" in result.content

    def test_markdown_file(self):
        content = b"# Title\n\nSome markdown content"
        result = parse_file(content, "notes.md")
        assert result.engine_used == "text"
        assert "# Title" in result.content

    def test_json_file(self):
        content = b'{"key": "value"}'
        result = parse_file(content, "data.json")
        assert result.engine_used == "text"
        assert '"key"' in result.content

    def test_unknown_extension_treated_as_text(self):
        content = b"some text content"
        result = parse_file(content, "file.unknown")
        assert result.engine_used == "text"
        assert len(result.warnings) > 0

    def test_unsupported_binary_raises(self):
        # Random binary data that can't be decoded as UTF-8
        content = bytes(range(128, 256))
        with pytest.raises(ValueError, match="Unsupported file format"):
            parse_file(content, "file.bin")


class TestParseResult:
    def test_default_values(self):
        r = ParseResult(content="test", engine_used="test_engine")
        assert r.page_count == 0
        assert r.metadata == {}
        assert r.warnings == []


class TestExtensionSets:
    def test_pdf_extensions(self):
        assert ".pdf" in PDF_EXTENSIONS

    def test_excel_extensions(self):
        assert ".xlsx" in EXCEL_EXTENSIONS
        assert ".xls" in EXCEL_EXTENSIONS
        assert ".csv" in EXCEL_EXTENSIONS

    def test_text_extensions(self):
        assert ".txt" in TEXT_EXTENSIONS
        assert ".md" in TEXT_EXTENSIONS


class TestParsePdfAuto:
    def test_auto_parse_minimal_pdf(self):
        """Test that AUTO engine can parse a minimal valid PDF."""
        # Minimal valid PDF
        minimal_pdf = (
            b"%PDF-1.0\n"
            b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
            b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n"
            b"xref\n0 4\n"
            b"0000000000 65535 f \n"
            b"0000000009 00000 n \n"
            b"0000000058 00000 n \n"
            b"0000000115 00000 n \n"
            b"trailer<</Size 4/Root 1 0 R>>\n"
            b"startxref\n190\n%%EOF"
        )
        result = parse_pdf(minimal_pdf, engine=ParseEngine.AUTO)
        assert result.engine_used in ("pymupdf", "docling", "pypdf2")
        assert isinstance(result.content, str)


class TestParseExcel:
    def test_csv_parsing(self):
        csv_data = b"name,value\nAlpha,100\nBeta,200\n"
        result = parse_excel(csv_data, filename="test.csv")
        assert result.engine_used == "pandas"
        assert "Alpha" in result.content
        assert "Beta" in result.content
        assert result.metadata["sheet_count"] == 1

    def test_csv_via_parse_file(self):
        csv_data = b"col1,col2\na,1\nb,2\n"
        result = parse_file(csv_data, "data.csv")
        assert result.engine_used == "pandas"
        assert "col1" in result.content
