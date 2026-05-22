"""Orchestrates layout, metadata/font, and ELA forgery sub-pipelines."""

from __future__ import annotations

import numpy as np

from app.core.config import Settings
from app.models.schemas import ForgeryDetectionResult
from app.services.forgery.ela import run_ela
from app.services.forgery.layout import evaluate_layout
from app.services.forgery.metadata_font import evaluate_metadata_font


def _aggregate_forgery_score(
    layout_score: float,
    layout_valid: bool,
    meta_score: float,
    font_score: float,
    ela_score: float,
) -> float:
    """
    Weighted forgery probability (0 = authentic, 1 = highly suspicious).
    Invert layout/font scores where higher means *more* authentic.
    """
    layout_risk = 1.0 - layout_score if layout_valid else 1.0 - layout_score * 0.5 + 0.35
    font_risk = 1.0 - font_score
    composite = (
        0.30 * min(1.0, max(0.0, layout_risk))
        + 0.25 * meta_score
        + 0.20 * font_risk
        + 0.25 * ela_score
    )
    return round(min(1.0, max(0.0, composite)), 4)


def _verdict(forgery_score: float, structural_integrity: bool, settings: Settings) -> str:
    if not structural_integrity or forgery_score >= settings.forgery_alert_threshold:
        return "rejected"
    if forgery_score >= settings.forgery_alert_threshold * 0.65:
        return "suspected"
    return "authentic"


def run_forgery_detection(
    image_bgr: np.ndarray,
    filename: str,
    settings: Settings,
) -> ForgeryDetectionResult:
    layout = evaluate_layout(image_bgr, settings)
    metadata_font = evaluate_metadata_font(image_bgr, filename)
    ela = run_ela(image_bgr, settings)

    forgery_score = _aggregate_forgery_score(
        layout.layout_match_score,
        layout.layout_valid,
        metadata_font.metadata_tamper_score,
        metadata_font.font_consistency_score,
        ela.ela_suspicion_score,
    )

    structural_integrity = (
        layout.layout_valid
        and not metadata_font.metadata_tamper_detected
        and not metadata_font.font_inconsistency_detected
        and not ela.digitally_edited_regions_detected
    )

    verdict = _verdict(forgery_score, structural_integrity, settings)

    return ForgeryDetectionResult(
        layout=layout,
        metadata_font=metadata_font,
        ela=ela,
        forgery_score=forgery_score,
        structural_integrity=structural_integrity,
        verdict=verdict,  # type: ignore[arg-type]
    )
