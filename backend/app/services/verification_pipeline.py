"""End-to-end KYC document verification pipeline."""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

import numpy as np

from app.core.config import settings
from app.core.exceptions import InvalidDocumentError
from app.core.metrics_store import metrics_store
from app.models.schemas import VerifyDocumentResponse
from app.services.document_loader import load_document_bgr
from app.services.forgery.pipeline import run_forgery_pipeline
from app.services.ocr import run_ocr
from app.services.preprocessing import preprocess_image


def _determine_status(
    *,
    forgery_score: float,
    is_suspected_fake: bool,
    ocr_confidence: float,
    structural_integrity: bool,
) -> str:
    if is_suspected_fake or forgery_score >= settings.forgery_alert_threshold:
        return "flagged"
    if not structural_integrity or ocr_confidence < 50.0:
        return "pending_review"
    return "verified"


def _run_pipeline_sync(
    content: bytes,
    content_type: str | None,
    filename: str | None,
) -> VerifyDocumentResponse:
    if len(content) > settings.max_upload_bytes:
        raise InvalidDocumentError(
            f"File exceeds maximum size of {settings.max_upload_bytes} bytes"
        )

    if content_type and content_type not in settings.allowed_mime_types:
        # Allow generic octet-stream if extension looks valid
        if content_type != "application/octet-stream":
            raise InvalidDocumentError(f"MIME type not allowed: {content_type}")

    image_bgr = load_document_bgr(content, content_type, filename)
    gray, preprocessing = preprocess_image(image_bgr)
    ocr = run_ocr(gray)
    forgery = run_forgery_pipeline(
        image_bgr=image_bgr,
        gray=gray,
        image_bytes=content,
        raw_text=ocr.raw_text,
    )

    status = _determine_status(
        forgery_score=forgery.forgery_score,
        is_suspected_fake=forgery.is_suspected_fake,
        ocr_confidence=ocr.ocr_confidence,
        structural_integrity=forgery.layout.structural_integrity,
    )

    metrics_store.record_verification(
        flagged=status == "flagged",
        pending=status == "pending_review",
    )

    return VerifyDocumentResponse(
        verification_id=str(uuid.uuid4()),
        status=status,
        ocr_confidence=ocr.ocr_confidence,
        forgery_score=forgery.forgery_score,
        structural_integrity=forgery.layout.structural_integrity,
        preprocessing=preprocessing,
        ocr=ocr,
        forgery=forgery,
    )


async def verify_document(
    content: bytes,
    content_type: str | None,
    filename: str | None,
) -> VerifyDocumentResponse:
    return await asyncio.to_thread(
        _run_pipeline_sync, content, content_type, filename
    )
