# PDF 知识库解析方案调研

## 当前状态

当前知识库支持 4 种内容上传方式：

| 类型 | doc_type | 说明 |
|------|----------|------|
| PDF | `pdf` | 通过 PyPDF2 提取文本 |
| URL | `url` | 抓取网页内容 |
| 笔记 (Note) | `note` | 用户直接输入文本 |
| 文本文件 (Report) | `report` | TXT、MD、CSV、JSON 等 |

### 当前 PDF 解析的局限性

使用 PyPDF2 `page.extract_text()` 只能提取纯文本，无法处理：
- 表格结构（财报关键数据会丢失结构）
- 图片 / 图表
- 数学公式
- 扫描件 PDF（需要 OCR）
- 复杂多栏布局

## OpenNotebook 方案

[lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) 采用：

1. **content-core** 库（内部使用 PyMuPDF）作为基础提取引擎
2. 可选集成 **Docling**（IBM 开源）作为高级文档解析器

双引擎架构：快速基础解析 + 复杂文档高级解析。

## 开源方案对比

| 方案 | 速度 | 表格准确率 | OCR | License | 特点 |
|------|------|-----------|-----|---------|------|
| PyMuPDF / pymupdf4llm | 极快 (~0.5s) | 一般 | 无 | AGPL | 速度最快，适合大规模处理 |
| pdfplumber | 慢 (~9.5s) | 好 | 无 | MIT | 表格提取最佳 |
| Docling (IBM) | 中等 | 97.9% | 有 | MIT | 表格准确率最高，本地运行 |
| Marker | 中等（需GPU） | 好 | 有 (Surya) | GPL | 支持 90+ 语言，适合学术文档 |
| Unstructured.io | 中等 | 中等 | 有 | Apache 2.0 | 语义分块，RAG 友好 |
| RAGFlow / DeepDoc | 中等 | 好 | 有 | Apache 2.0 | 完整 RAG 管道：OCR + 版面识别 |
| Nougat (Meta) | 慢 | 好 | 有 | MIT | 学术 PDF 专用，已被新工具超越 |
| LlamaParse | 快 (~17s) | 最好 | 有 | 闭源(云端) | 准确率最高但非开源 |

## 推荐方案

### 首选：Docling (IBM)

- 表格准确率 97.9%，对财报解析至关重要
- MIT 协议，可商用
- 本地运行，无需云端
- 原生支持 LangChain / LlamaIndex 集成
- 安装：`pip install docling`

### 备选：PyMuPDF4LLM + pdfplumber 组合

- PyMuPDF4LLM 负责快速文本提取
- pdfplumber 负责表格解析
- 两者互补，都是成熟库

### 扫描件场景：RAGFlow / DeepDoc

- 完整的 OCR + 版面分析 + 表格结构识别管道
- 部署复杂度较高

## 实施建议

替换 `iris/backend/api.py` 中的 PyPDF2 解析逻辑，改用 Docling：

```python
# Before (current)
from PyPDF2 import PdfReader
reader = PdfReader(io.BytesIO(content_bytes))
pages_text = [page.extract_text() or "" for page in reader.pages]
content_text = "\n\n".join(pages_text)

# After (proposed)
from docling.document_converter import DocumentConverter
converter = DocumentConverter()
result = converter.convert(file_path)
content_text = result.document.export_to_markdown()
```

Docling 输出 Markdown 格式，表格会保留结构，适合后续 LLM 处理和 chunking。
