import asyncio

from fastapi import APIRouter, File, UploadFile

from app.core.config import get_settings
from app.core.exceptions import KYCServiceError, UnsupportedDocumentError, to_http_exception
from app.models.schemas import VerifyDocumentResponse
from app.services.file_loader import bytes_to_bgr
from app.services.pipeline import run_verification_pipeline

router = APIRouter(tags=["verification"])


@router.post(
    "/verify-document",
    response_model=VerifyDocumentResponse,
    summary="Run full KYC document verification pipeline",
)
async def verify_document(
    file: UploadFile = File(..., description="JPEG, PNG, or PDF identity document"),
) -> VerifyDocumentResponse:
    settings = get_settings()
    content_type = file.content_type or ""
    filename = file.filename or "upload.bin"

    if content_type and content_type not in settings.allowed_mime_types:
        # Allow extension-based fallback when browsers send octet-stream
        if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".pdf")):
            raise to_http_exception(
                UnsupportedDocumentError(
                    f"Unsupported media type '{content_type}'. Allowed: JPEG, PNG, PDF."
                )
            )

    raw = await file.read()
    if len(raw) > settings.max_upload_bytes:
        raise to_http_exception(
            UnsupportedDocumentError(
                f"File exceeds maximum size of {settings.max_upload_bytes // (1024 * 1024)}MB."
            )
        )
    if not raw:
        raise to_http_exception(UnsupportedDocumentError("Empty file uploaded."))

    try:
        image_bgr = await asyncio.to_thread(
            bytes_to_bgr, raw, content_type, filename
        )
        result = await run_verification_pipeline(image_bgr, filename, settings)
        return result
    except KYCServiceError as exc:
        raise to_http_exception(exc) from exc
    except Exception as exc:
        raise to_http_exception(
            KYCServiceError(f"Unexpected pipeline failure: {exc}")
        ) from exc
