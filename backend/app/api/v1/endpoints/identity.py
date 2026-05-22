from fastapi import APIRouter

from app.core.exceptions import KYCBaseError, to_http_exception
from app.models.schemas import IdentityValidationRequest, IdentityValidationResponse
from app.services.identity_validator import validate_identity

router = APIRouter()


@router.post(
    "/validate-identity",
    response_model=IdentityValidationResponse,
    summary="Validate OCR fields against core identity registry",
)
async def validate_identity_endpoint(
    payload: IdentityValidationRequest,
) -> IdentityValidationResponse:
    try:
        return validate_identity(payload)
    except KYCBaseError as exc:
        raise to_http_exception(exc) from exc
