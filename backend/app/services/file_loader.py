import io
from typing import Any

import cv2
import numpy as np
from PIL import Image

from app.core.config import Settings
from app.core.exceptions import InvalidDocumentError


def decode_upload(content: bytes, content_type: str, settings: Settings) -> np.ndarray:
    """Decode uploaded bytes into a BGR OpenCV image."""
    if len(content) > settings.max_upload_bytes:
        raise InvalidDocumentError(
            f"File exceeds maximum size of {settings.max_upload_bytes // (1024 * 1024)}MB.",
            code="file_too_large",
        )

    normalized_type = content_type.split(";")[0].strip().lower()
    if normalized_type not in settings.allowed_content_types:
        raise InvalidDocumentError(
            "Unsupported file type. Allowed: JPEG, PNG, PDF.",
            code="unsupported_media_type",
        )

    try:
        if normalized_type == "application/pdf":
            return _pdf_to_bgr(content)
        return _image_bytes_to_bgr(content)
    except InvalidDocumentError:
        raise
    except Exception as exc:
        raise InvalidDocumentError(
            "Unable to decode uploaded document.",
            code="decode_failed",
        ) from exc


def _image_bytes_to_bgr(content: bytes) -> np.ndarray:
    pil_image = Image.open(io.BytesIO(content))
    if pil_image.mode not in ("RGB", "L", "RGBA"):
        pil_image = pil_image.convert("RGB")
    rgb = np.array(pil_image.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    if bgr.size == 0:
        raise InvalidDocumentError("Empty or corrupt image.", code="empty_image")
    return bgr


def _pdf_to_bgr(content: bytes) -> np.ndarray:
    try:
        from pdf2image import convert_from_bytes
    except ImportError as exc:
        raise InvalidDocumentError(
            "PDF support requires pdf2image and poppler.",
            code="pdf_dependency_missing",
        ) from exc

    pages: list[Any] = convert_from_bytes(content, first_page=1, last_page=1, dpi=200)
    if not pages:
        raise InvalidDocumentError("PDF contains no renderable pages.", code="empty_pdf")
    rgb = np.array(pages[0].convert("RGB"))
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
