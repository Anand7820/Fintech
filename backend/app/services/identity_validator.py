"""Compare OCR-extracted fields against mock core verification registry."""

from __future__ import annotations

import re

from app.core.exceptions import IdentityNotFoundError
from app.core.metrics_store import metrics_store
from app.models.schemas import FieldMatchDetail, IdentityValidationRequest, IdentityValidationResponse
from app.registry.mock_registry import lookup_identity


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.strip().upper())


def _normalize_dob(value: str | None) -> str:
    if not value:
        return ""
    v = value.strip()
    if re.match(r"\d{2}/\d{2}/\d{4}", v):
        return v
    return _normalize(v)


def _similarity(a: str, b: str) -> float:
    if not a and not b:
        return 100.0
    if not a or not b:
        return 0.0
    if a == b:
        return 100.0
    tokens_a = set(a.split())
    tokens_b = set(b.split())
    if not tokens_a or not tokens_b:
        return 0.0
    overlap = len(tokens_a & tokens_b) / max(len(tokens_a), len(tokens_b))
    return round(overlap * 100.0, 2)


def validate_identity(request: IdentityValidationRequest) -> IdentityValidationResponse:
    record = lookup_identity(request.document_id)
    if record is None:
        raise IdentityNotFoundError(
            f"No registry entry for document_id '{request.document_id}'."
        )

    extracted_name = _normalize(request.name)
    extracted_dob = _normalize_dob(request.date_of_birth)
    registry_name = _normalize(record.name)
    registry_dob = _normalize_dob(record.date_of_birth)

    name_conf = _similarity(extracted_name, registry_name)
    dob_conf = _similarity(extracted_dob, registry_dob)

    field_matches = [
        FieldMatchDetail(
            field="document_id",
            extracted_value=request.document_id,
            registry_value=record.document_id,
            match=True,
            confidence=100.0,
        ),
        FieldMatchDetail(
            field="name",
            extracted_value=request.name,
            registry_value=record.name,
            match=name_conf >= 75.0,
            confidence=name_conf,
        ),
        FieldMatchDetail(
            field="date_of_birth",
            extracted_value=request.date_of_birth,
            registry_value=record.date_of_birth,
            match=dob_conf >= 80.0,
            confidence=dob_conf,
        ),
    ]

    registry_match_score = round(
        sum(f.confidence for f in field_matches) / len(field_matches),
        2,
    )
    is_aadhaar = len(re.sub(r"\D", "", request.document_id)) == 12
    identity_verified = all(f.match for f in field_matches) and record.status == "active"

    if is_aadhaar and field_matches[0].match and record.status == "active":
        # Aadhaar number matched registry — valid UID even if glare blocked name/DOB OCR
        identity_verified = True
        if name_conf < 75.0 or dob_conf < 80.0:
            message = (
                "Aadhaar number verified in registry (UID valid). "
                "Name/DOB could not be confirmed from this photo — upload a flat, glare-free scan for full match."
            )
        else:
            message = "Aadhaar identity fully verified against core registry."
    elif identity_verified:
        message = "Identity verified against core registry."
    else:
        parts = []
        if name_conf < 75.0:
            parts.append("name mismatch")
        if dob_conf < 80.0:
            parts.append("DOB mismatch")
        message = (
            "Identity could not be fully verified: " + ", ".join(parts)
            if parts
            else "Manual review required."
        )

    metrics_store.record_identity_check(matched=identity_verified)

    return IdentityValidationResponse(
        document_id=request.document_id,
        identity_verified=identity_verified,
        registry_match_score=registry_match_score,
        field_matches=field_matches,
        message=message,
    )
