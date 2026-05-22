"""Load uploaded bytes into OpenCV BGR matrices (images and PDF first page)."""

from __future__ import annotations

import cv2
import numpy as np

from app.core.exceptions import InvalidDocumentError
def bytes_to_bgr(content: bytes) -> np.ndarray:
    nparr = np.frombuffer(content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise InvalidDocumentError("Could not decode image bytes")
    return img


def _pdf_first_page_to_bgr(pdf_bytes: bytes) -> np.ndarray:
    try:
        from pdf2image import convert_from_bytes
    except ImportError as exc:
        raise InvalidDocumentError(
            "PDF support requires pdf2image and poppler. Install: pip install pdf2image"
        ) from exc

    try:
        pages = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, dpi=200)
    except Exception as exc:
        raise InvalidDocumentError(f"Failed to rasterize PDF: {exc}") from exc

    if not pages:
        raise InvalidDocumentError("PDF contains no pages")

    pil_image = pages[0].convert("RGB")
    rgb = np.array(pil_image)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def load_document_bgr(content: bytes, content_type: str | None, filename: str | None) -> np.ndarray:
    mime = (content_type or "").lower()
    name = (filename or "").lower()

    is_pdf = mime == "application/pdf" or name.endswith(".pdf")
    if is_pdf:
        return _pdf_first_page_to_bgr(content)

    if mime.startswith("image/") or name.endswith((".jpg", ".jpeg", ".png")):
        return bytes_to_bgr(content)

    # Attempt decode anyway
    try:
        return bytes_to_bgr(content)
    except Exception as exc:
        raise InvalidDocumentError(
            f"Unsupported document format: {content_type or filename}"
        ) from exc
