from fastapi import APIRouter

from app.core.exceptions import IdentityNotFoundError, KYCServiceError, to_http_exception
from app.models.schemas import ValidateIdentityRequest, ValidateIdentityResponse
from app.services.identity_validator import validate_identity

router = APIRouter(tags=["identity"])


@router.post(
    "/validate-identity",
    response_model=ValidateIdentityResponse,
    summary="Validate extracted fields against core registry",
)
async def validate_identity_endpoint(
    payload: ValidateIdentityRequest,
) -> ValidateIdentityResponse:
    try:
        return await validate_identity(payload)
    except IdentityNotFoundError as exc:
        raise to_http_exception(exc) from exc
    except KYCServiceError as exc:
        raise to_http_exception(exc) from exc
