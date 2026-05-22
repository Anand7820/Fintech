"""Compare OCR-extracted fields against mock core verification registry."""

from __future__ import annotations

import re

from app.core.exceptions import IdentityNotFoundError
from app.models.schemas import FieldMatchDetail, ValidateIdentityRequest, ValidateIdentityResponse
from app.registry.mock_registry import lookup_by_document_id
from app.services.metrics_store import metrics_store


def _normalize(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.strip().upper())


def _similarity(a: str, b: str) -> float:
    if not a and not b:
        return 100.0
    if not a or not b:
        return 0.0
    if a == b:
        return 100.0
    # Token overlap ratio
    tokens_a = set(a.split())
    tokens_b = set(b.split())
    if not tokens_a or not tokens_b:
        return 0.0
    overlap = len(tokens_a & tokens_b) / max(len(tokens_a), len(tokens_b))
    return round(overlap * 100.0, 2)


async def validate_identity(request: ValidateIdentityRequest) -> ValidateIdentityResponse:
    record = lookup_by_document_id(request.document_id)
    if record is None:
        await metrics_store.record_identity_miss()
        raise IdentityNotFoundError(
            f"No registry entry for document_id '{request.document_id}'."
        )

    extracted_name = _normalize(request.name)
    extracted_dob = _normalize(request.date_of_birth)
    registry_name = _normalize(record.name)
    registry_dob = _normalize(record.date_of_birth)

    name_match_conf = _similarity(extracted_name, registry_name)
    dob_match_conf = _similarity(extracted_dob, registry_dob)

    field_matches = [
        FieldMatchDetail(
            field="document_id",
            extracted_value=request.document_id,
            registry_value=record.document_id,
            match=True,
            match_confidence=100.0,
        ),
        FieldMatchDetail(
            field="name",
            extracted_value=request.name,
            registry_value=record.name,
            match=name_match_conf >= 80.0,
            match_confidence=name_match_conf,
        ),
        FieldMatchDetail(
            field="date_of_birth",
            extracted_value=request.date_of_birth,
            registry_value=record.date_of_birth,
            match=dob_match_conf >= 85.0,
            match_confidence=dob_match_conf,
        ),
    ]

    flags: list[str] = []
    if record.status == "pending_review":
        flags.append("Registry record is pending manual review.")
    if name_match_conf < 80.0:
        flags.append("Name mismatch against core registry.")
    if dob_match_conf < 85.0:
        flags.append("Date of birth mismatch against core registry.")

    overall = sum(f.match_confidence for f in field_matches) / len(field_matches)
    identity_verified = all(f.match for f in field_matches) and record.status == "active"

    response = ValidateIdentityResponse(
        registry_id=record.registry_id,
        identity_verified=identity_verified,
        overall_match_confidence=round(overall, 2),
        field_matches=field_matches,
        flags=flags,
    )

    await metrics_store.record_identity_validation(identity_verified)
    return response
