"""End-to-end KYC document verification pipeline."""

from __future__ import annotations

import uuid
from typing import Literal

from app.core.config import Settings
from app.models.schemas import VerifyDocumentResponse
from app.services.forgery.detector import run_forgery_detection
from app.services.metrics_store import metrics_store
from app.services.ocr_engine import merge_demo_fields, run_ocr
from app.services.preprocessing import preprocess_image


def _infer_document_type(
    filename: str,
    layout_template: str | None,
) -> Literal["passport", "drivers_license", "utility_bill", "unknown"]:
    lower = filename.lower()
    if "passport" in lower or layout_template == "passport":
        return "passport"
    if "license" in lower or "dl" in lower or layout_template == "drivers_license":
        return "drivers_license"
    if "utility" in lower or "bill" in lower or layout_template == "utility_bill":
        return "utility_bill"
    return "unknown"


async def run_verification_pipeline(
    image_bgr: np.ndarray,
    filename: str,
    settings: Settings,
) -> VerifyDocumentResponse:
    verification_id = str(uuid.uuid4())

    processed_bgr, preprocessing = preprocess_image(image_bgr)
    fields, ocr_confidence, _raw = run_ocr(processed_bgr, settings)
    fields, ocr_confidence = merge_demo_fields(fields, filename, ocr_confidence)

    forgery = run_forgery_detection(processed_bgr, filename, settings)
    doc_type = _infer_document_type(filename, forgery.layout.template_matched)

    warnings: list[str] = []
    if ocr_confidence < 70.0:
        warnings.append("Low OCR confidence — manual review recommended.")
    if not fields.document_id:
        warnings.append("Document ID could not be extracted reliably.")
    if forgery.verdict == "suspected":
        warnings.append("Document flagged as suspected forgery/tampering.")
    if forgery.verdict == "rejected":
        warnings.append("Document failed structural integrity checks.")

    response = VerifyDocumentResponse(
        verification_id=verification_id,
        document_type=doc_type,
        ocr_confidence=round(ocr_confidence, 2),
        extracted_fields=fields,
        preprocessing=preprocessing,
        forgery=forgery,
        pipeline_status="completed",
        warnings=warnings,
    )

    await metrics_store.record_verification(
        verification_id=verification_id,
        ocr_confidence=ocr_confidence,
        forgery_score=forgery.forgery_score,
        verdict=forgery.verdict,
        structural_integrity=forgery.structural_integrity,
    )

    return response
