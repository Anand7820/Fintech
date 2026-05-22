import numpy as np

from app.core.config import Settings
from app.models.schemas import ForgeryAnalysis
from app.services.forgery.ela import analyze_ela
from app.services.forgery.layout import analyze_layout
from app.services.forgery.metadata import analyze_metadata


def run_forgery_pipeline(
    image_bgr: np.ndarray,
    settings: Settings,
    *,
    raw_text: str = "",
) -> ForgeryAnalysis:
    """Execute layout, metadata, and ELA forgery checks; aggregate forgery_score."""
    layout = analyze_layout(image_bgr, settings, raw_text=raw_text)
    metadata = analyze_metadata(image_bgr, raw_text=raw_text)
    ela = analyze_ela(image_bgr, settings)

    # Weighted composite: higher = more suspicious
    layout_risk = 1.0 - layout.layout_match_score
    metadata_risk = 1.0 - metadata.font_consistency_score
    if metadata.metadata_tampering_detected:
        metadata_risk = min(1.0, metadata_risk + 0.25)

    ela_risk = max(ela.ela_variance_score, ela.suspicious_region_ratio)

    forgery_score = round(
        0.35 * layout_risk + 0.30 * metadata_risk + 0.35 * ela_risk,
        4,
    )
    is_suspected = (
        not layout.structural_integrity
        or metadata.metadata_tampering_detected
        or ela.resave_regions_detected
        or forgery_score >= settings.forgery_alert_threshold
    )

    return ForgeryAnalysis(
        layout=layout,
        metadata=metadata,
        ela=ela,
        forgery_score=forgery_score,
        is_suspected_fake=is_suspected,
    )
