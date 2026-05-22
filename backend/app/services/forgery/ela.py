import io

import cv2
import numpy as np
from PIL import Image

from app.core.config import Settings
from app.models.schemas import ELAAnalysis


def analyze_ela(image_bgr: np.ndarray, settings: Settings) -> ELAAnalysis:
    """
    Error Level Analysis: recompress at fixed JPEG quality and measure
    pixel-level residual variance. Edited regions often diverge from background.
    """
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_original = Image.fromarray(rgb)

    buffer = io.BytesIO()
    pil_original.save(buffer, format="JPEG", quality=90)
    buffer.seek(0)
    recompressed = np.array(Image.open(buffer).convert("RGB"))

    original = np.array(pil_original).astype(np.float32)
    residual = np.abs(original - recompressed.astype(np.float32))
    residual_gray = np.mean(residual, axis=2)

    # Normalize high-residual regions
    threshold = float(np.percentile(residual_gray, 92))
    suspicious_mask = residual_gray >= threshold
    suspicious_ratio = float(np.mean(suspicious_mask))

    variance_score = float(np.std(residual_gray) / 255.0)
    variance_score = min(1.0, variance_score * 4.0)

    resave_detected = (
        suspicious_ratio >= settings.ela_suspicion_threshold
        or variance_score >= settings.ela_suspicion_threshold
    )

    return ELAAnalysis(
        ela_variance_score=round(variance_score, 4),
        resave_regions_detected=resave_detected,
        suspicious_region_ratio=round(suspicious_ratio, 4),
    )
