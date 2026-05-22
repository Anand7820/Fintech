import re

from app.core.exceptions import IdentityNotFoundError
from app.models.schemas import FieldMatchDetail, IdentityValidationRequest, IdentityValidationResponse
from app.registry.mock_registry import RegistryRecord, lookup_identity


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def _fuzzy_name_match(extracted: str | None, registry_name: str) -> tuple[bool, float]:
    if not extracted:
        return False, 0.0
    ext_tokens = set(_normalize(extracted))
    reg_tokens = set(_normalize(registry_name))
    if not ext_tokens or not reg_tokens:
        return False, 0.0
    overlap = len(ext_tokens & reg_tokens) / max(len(reg_tokens), 1)
    match = overlap >= 0.55
    confidence = round(min(100.0, overlap * 100.0 + (20.0 if match else 0.0)), 2)
    return match, confidence


def _exact_field_match(extracted: str | None, registry_value: str) -> tuple[bool, float]:
    if not extracted:
        return False, 0.0
    match = _normalize(extracted) == _normalize(registry_value)
    return match, 100.0 if match else 35.0


def validate_identity(payload: IdentityValidationRequest) -> IdentityValidationResponse:
    record: RegistryRecord | None = lookup_identity(payload.document_id)
    if record is None:
        raise IdentityNotFoundError(
            f"No registry entry found for document_id '{payload.document_id}'.",
            code="identity_not_found",
        )

    name_match, name_conf = _fuzzy_name_match(payload.name, record.name)
    dob_match, dob_conf = _exact_field_match(payload.date_of_birth, record.date_of_birth)
    id_match, id_conf = _exact_field_match(payload.document_id, record.document_id)

    field_matches = [
        FieldMatchDetail(
            field="document_id",
            extracted_value=payload.document_id,
            registry_value=record.document_id,
            match=id_match,
            confidence=id_conf,
        ),
        FieldMatchDetail(
            field="name",
            extracted_value=payload.name,
            registry_value=record.name,
            match=name_match,
            confidence=name_conf,
        ),
        FieldMatchDetail(
            field="date_of_birth",
            extracted_value=payload.date_of_birth,
            registry_value=record.date_of_birth,
            match=dob_match,
            confidence=dob_conf,
        ),
    ]

    scores = [m.confidence for m in field_matches if m.extracted_value]
    registry_match_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    identity_verified = all(m.match for m in field_matches if m.extracted_value) and registry_match_score >= 75.0

    message = (
        "Identity verified against core registry."
        if identity_verified
        else "Identity mismatch or incomplete OCR fields — manual review required."
    )

    return IdentityValidationResponse(
        document_id=payload.document_id,
        identity_verified=identity_verified,
        registry_match_score=registry_match_score,
        field_matches=field_matches,
        message=message,
    )
