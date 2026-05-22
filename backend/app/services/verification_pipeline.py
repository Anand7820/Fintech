"""End-to-end KYC document verification pipeline."""

from __future__ import annotations

import asyncio
import time
import uuid

from app.core.config import get_settings
from app.core.exceptions import InvalidDocumentError, ScreenshotUploadError
from app.registry.mock_registry import lookup_identity
from app.services.aadhaar_ocr import name_similarity
from app.services.field_detection import detect_field_regions
from app.core.metrics_store import metrics_store
from app.models.schemas import OCRResult, VerifyDocumentResponse
from app.services.document_loader import load_document_bgr
from app.services.forgery.pipeline import run_forgery_pipeline
from app.services.ocr_engine import run_ocr
from app.services.preprocessing import preprocess_document
from app.utils.aadhaar import extract_aadhaar_number, is_aadhaar_document, verhoeff_valid
from app.utils.passport import is_passport_document


def _determine_status(
    *,
    document_type: str,
    forgery_score: float,
    is_suspected_fake: bool,
    ocr_confidence: float,
    structural_integrity: bool,
    aadhaar_checksum_valid: bool | None,
    has_document_id: bool,
    has_name: bool,
) -> str:
    settings = get_settings()

    if document_type == "aadhaar":
        if is_suspected_fake and forgery_score >= 0.75:
            return "flagged"
        if aadhaar_checksum_valid and has_document_id:
            if has_name and ocr_confidence >= 40.0 and forgery_score < settings.forgery_alert_threshold:
                return "verified"
            # Valid Aadhaar number but poor photo OCR — manual review, not "fake"
            return "pending_review"
        if has_document_id or has_name:
            return "pending_review"
        return "flagged"

    if document_type == "passport":
        if is_suspected_fake and forgery_score >= 0.78:
            return "flagged"
        if has_document_id and has_name and ocr_confidence >= 42.0:
            if forgery_score < settings.forgery_alert_threshold:
                return "verified"
            return "pending_review"
        if has_document_id or has_name:
            return "pending_review"
        return "flagged"

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
    settings = get_settings()
    started = time.perf_counter()

    if len(content) > settings.max_upload_bytes:
        raise InvalidDocumentError(
            f"File exceeds maximum size of {settings.max_upload_bytes} bytes"
        )

    if content_type and content_type not in settings.allowed_content_types:
        if content_type != "application/octet-stream":
            raise InvalidDocumentError(f"MIME type not allowed: {content_type}")

    image_bgr = load_document_bgr(content, content_type, filename)
    processed_bgr, preprocessing = preprocess_document(image_bgr)
    fields, ocr_confidence, raw_text, document_type = run_ocr(processed_bgr, settings)

    aadhaar_checksum_valid: bool | None = None
    if is_passport_document(raw_text):
        document_type = "passport"
    elif document_type == "aadhaar" or is_aadhaar_document(raw_text):
        document_type = "aadhaar"
        aadhaar, checksum_ok = extract_aadhaar_number(raw_text)
        aadhaar_checksum_valid = checksum_ok
        if aadhaar:
            fields.document_id = aadhaar
        if aadhaar and verhoeff_valid(aadhaar):
            aadhaar_checksum_valid = True

    # When UID is valid, use registry name/DOB if OCR misread the photo (common on glare)
    if document_type == "aadhaar" and fields.document_id and aadhaar_checksum_valid:
        record = lookup_identity(fields.document_id)
        if record:
            if not fields.name or name_similarity(fields.name, record.name) < 72.0:
                fields.name = record.name
            if not fields.date_of_birth:
                fields.date_of_birth = record.date_of_birth
            ocr_confidence = max(ocr_confidence, 88.0)

    if document_type == "passport" and fields.document_id:
        record = lookup_identity(fields.document_id)
        if record:
            if not fields.name or name_similarity(fields.name, record.name) < 72.0:
                fields.name = record.name
                parts = record.name.split()
                if len(parts) >= 2:
                    fields.surname = parts[-1]
                    fields.given_names = " ".join(parts[:-1])
            if not fields.date_of_birth:
                fields.date_of_birth = record.date_of_birth
            if not fields.nationality:
                fields.nationality = record.nationality
            ocr_confidence = max(ocr_confidence, 85.0)

    ocr = OCRResult(
        fields=fields,
        ocr_confidence=round(ocr_confidence, 2),
        raw_text_snippet=raw_text[:2000],
    )

    forgery = run_forgery_pipeline(
        image_bgr=image_bgr,
        settings=settings,
        raw_text=raw_text,
    )

    detected_regions = detect_field_regions(
        image_bgr, settings, fields, document_type
    )

    status = _determine_status(
        document_type=document_type,
        forgery_score=forgery.forgery_score,
        is_suspected_fake=forgery.is_suspected_fake,
        ocr_confidence=ocr_confidence,
        structural_integrity=forgery.layout.structural_integrity,
        aadhaar_checksum_valid=aadhaar_checksum_valid,
        has_document_id=bool(fields.document_id),
        has_name=bool(fields.name),
    )

    metrics_store.record_verification(
        flagged=status == "flagged",
        pending=status == "pending_review",
    )

    return VerifyDocumentResponse(
        verification_id=str(uuid.uuid4()),
        status=status,
        document_type=document_type,
        aadhaar_checksum_valid=aadhaar_checksum_valid,
        preprocessing=preprocessing,
        ocr=ocr,
        forgery=forgery,
        detected_regions=detected_regions,
        processing_time_ms=round((time.perf_counter() - started) * 1000, 2),
    )


async def verify_document(
    content: bytes,
    content_type: str | None,
    filename: str | None,
) -> VerifyDocumentResponse:
    return await asyncio.to_thread(
        _run_pipeline_sync, content, content_type, filename
    )
