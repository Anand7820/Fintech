from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import get_app_settings
from app.core.config import Settings
from app.core.exceptions import KYCBaseError, to_http_exception
from app.models.schemas import VerifyDocumentResponse
from app.services.verification import run_verification_pipeline

router = APIRouter()


@router.post(
    "/verify-document",
    response_model=VerifyDocumentResponse,
    summary="Run full KYC document verification pipeline",
)
async def verify_document(
    file: UploadFile = File(..., description="Identity document image or PDF"),
    settings: Settings = Depends(get_app_settings),
) -> VerifyDocumentResponse:
    try:
        content = await file.read()
        content_type = file.content_type or "application/octet-stream"
        return await run_verification_pipeline(content, content_type, settings)
    except KYCBaseError as exc:
        raise to_http_exception(exc) from exc
