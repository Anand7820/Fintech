import asyncio
import time
import uuid

import numpy as np

from app.core.config import Settings
from app.core.exceptions import ForgeryAnalysisError, InvalidDocumentError, OCRProcessingError
from app.models.schemas import VerifyDocumentResponse
from app.services.file_loader import decode_upload
from app.services.forgery.pipeline import run_forgery_pipeline
from app.services.metrics_store import metrics_store
from app.services.ocr import extract_text
from app.services.preprocessing import preprocess_document


def _resolve_status(forgery_score: float, is_suspected: bool, ocr_confidence: float) -> str:
    if is_suspected or forgery_score >= 0.5:
        return "flagged"
    if ocr_confidence < 50.0:
        return "pending_review"
    return "verified"


async def run_verification_pipeline(
    content: bytes,
    content_type: str,
    settings: Settings,
) -> VerifyDocumentResponse:
    """Execute full KYC document verification pipeline off the event loop."""
    started = time.perf_counter()
    verification_id = f"ver_{uuid.uuid4().hex[:12]}"

    try:
        result = await asyncio.to_thread(_pipeline_sync, content, content_type, settings, verification_id)
    except (InvalidDocumentError, OCRProcessingError):
        raise
    except Exception as exc:
        raise ForgeryAnalysisError(
            "Forgery or preprocessing pipeline failed.",
            code="pipeline_failed",
        ) from exc

    await metrics_store.record(result.status)
    result.processing_time_ms = round((time.perf_counter() - started) * 1000, 2)
    return result


def _pipeline_sync(
    content: bytes,
    content_type: str,
    settings: Settings,
    verification_id: str,
) -> VerifyDocumentResponse:
    image_bgr = decode_upload(content, content_type, settings)
    processed, preprocessing = preprocess_document(image_bgr)
    ocr = extract_text(processed, settings)
    forgery = run_forgery_pipeline(processed, settings, raw_text=ocr.raw_text_snippet)

    status = _resolve_status(forgery.forgery_score, forgery.is_suspected_fake, ocr.ocr_confidence)

    return VerifyDocumentResponse(
        verification_id=verification_id,
        status=status,  # type: ignore[arg-type]
        preprocessing=preprocessing,
        ocr=ocr,
        forgery=forgery,
        processing_time_ms=0.0,
    )
