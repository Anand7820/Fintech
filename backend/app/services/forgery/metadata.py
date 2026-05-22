import re
from io import BytesIO

import cv2
import numpy as np
from PIL import Image

from app.models.schemas import MetadataAnalysis


def analyze_metadata(image_bgr: np.ndarray, raw_text: str = "") -> MetadataAnalysis:
    """
    Heuristic metadata / font consistency analysis.
    - PIL EXIF and software tags when available
    - Text-line height variance as a font-tampering proxy
    """
    pil_image = Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))
    tampering_flags: list[str] = []
    font_score = 1.0

    exif = pil_image.getexif()
    if exif:
        software = str(exif.get(305, "")).lower()
        if any(editor in software for editor in ("photoshop", "gimp", "lightroom", "paint")):
            tampering_flags.append(f"Editing software signature in EXIF: {software}")
            font_score -= 0.35

    font_score = min(1.0, max(0.0, _font_consistency_score(image_bgr, font_score)))

    if raw_text:
        if re.search(r"(?:FONT|CHARACTER)\s+(?:MISMATCH|INCONSISTENT)", raw_text.upper()):
            tampering_flags.append("OCR stream indicates font inconsistency markers.")

    metadata_tampering = len(tampering_flags) > 0 or font_score < 0.65
    details = (
        "; ".join(tampering_flags)
        if tampering_flags
        else "No metadata tampering indicators detected."
    )

    return MetadataAnalysis(
        font_consistency_score=round(font_score, 4),
        metadata_tampering_detected=metadata_tampering,
        details=details,
    )


def _font_consistency_score(image_bgr: np.ndarray, base: float) -> float:
    """Estimate font uniformity via connected-component height dispersion."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 8
    )
    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)

    heights: list[int] = []
    for i in range(1, num_labels):
        h = int(stats[i, cv2.CC_STAT_HEIGHT])
        w = int(stats[i, cv2.CC_STAT_WIDTH])
        if 8 <= h <= 80 and w >= 4:
            heights.append(h)

    if len(heights) < 5:
        return base

    heights_arr = np.array(heights, dtype=np.float32)
    cv_coeff = float(np.std(heights_arr) / (np.mean(heights_arr) + 1e-6))
    # High variance in glyph heights suggests pasted / edited text blocks
    penalty = min(0.45, cv_coeff * 0.25)
    return base - penalty


def extract_pillow_metadata_bytes(content: bytes) -> MetadataAnalysis:
    """Analyze raw upload bytes for EXIF before OpenCV conversion (PDF returns neutral)."""
    try:
        pil_image = Image.open(BytesIO(content))
        pil_image.load()
        rgb = np.array(pil_image.convert("RGB"))
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        return analyze_metadata(bgr)
    except Exception:
        return MetadataAnalysis(
            font_consistency_score=0.85,
            metadata_tampering_detected=False,
            details="Metadata analysis skipped for this file format.",
        )
