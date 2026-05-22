from fastapi import HTTPException, status


class KYCBaseError(Exception):
    """Base exception for domain errors."""

    def __init__(self, message: str, *, code: str = "kyc_error") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class InvalidDocumentError(KYCBaseError):
    pass


class OCRProcessingError(KYCBaseError):
    pass


class ForgeryAnalysisError(KYCBaseError):
    pass


class IdentityNotFoundError(KYCBaseError):
    pass


def to_http_exception(exc: KYCBaseError) -> HTTPException:
    status_map: dict[type[KYCBaseError], int] = {
        InvalidDocumentError: status.HTTP_400_BAD_REQUEST,
        OCRProcessingError: status.HTTP_422_UNPROCESSABLE_ENTITY,
        ForgeryAnalysisError: status.HTTP_422_UNPROCESSABLE_ENTITY,
        IdentityNotFoundError: status.HTTP_404_NOT_FOUND,
    }
    return HTTPException(
        status_code=status_map.get(type(exc), status.HTTP_500_INTERNAL_SERVER_ERROR),
        detail={"error": exc.code, "message": exc.message},
    )
