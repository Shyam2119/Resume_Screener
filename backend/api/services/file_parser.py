"""
File parsing service — extracts plain text from PDF and DOCX uploads.
"""
import io
import logging

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file using PyPDF2."""
    try:
        import PyPDF2

        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
        return "\n\n".join(pages)
    except ImportError:
        raise RuntimeError("PyPDF2 is not installed. Run: pip install pypdf2")
    except Exception as exc:
        logger.exception("PDF parsing failed")
        raise ValueError(f"Could not parse PDF: {exc}") from exc


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file using python-docx."""
    try:
        import docx

        doc = docx.Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        # Also extract text from tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        paragraphs.append(cell.text.strip())
        return "\n".join(paragraphs)
    except ImportError:
        raise RuntimeError("python-docx is not installed. Run: pip install python-docx")
    except Exception as exc:
        logger.exception("DOCX parsing failed")
        raise ValueError(f"Could not parse DOCX: {exc}") from exc


def extract_text(file_bytes: bytes, filename: str) -> str:
    """
    Dispatch to the correct parser based on file extension.
    Returns extracted plain text.
    """
    name_lower = filename.lower()
    if name_lower.endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
    elif name_lower.endswith((".docx", ".doc")):
        text = extract_text_from_docx(file_bytes)
    else:
        raise ValueError(
            f"Unsupported file type: {filename}. Please upload a PDF or DOCX file."
        )

    if not text.strip():
        raise ValueError(
            "No text could be extracted from the file. "
            "Please ensure the file is not a scanned image-only PDF."
        )

    return text.strip()
