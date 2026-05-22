"""
Document card bounds + standard field zones (percent of image).
Zones scale to detected card rectangle so overlays match any photo size.
"""

from __future__ import annotations

import cv2
import numpy as np

# (x%, y%, width%, height%) relative to detected document bounds
AADHAAR_ZONES: dict[str, tuple[float, float, float, float]] = {
    "portrait": (3.0, 54.0, 26.0, 34.0),
    "name": (30.0, 58.0, 62.0, 10.0),
    "dob": (30.0, 68.0, 38.0, 8.0),
    "gender": (52.0, 68.0, 22.0, 8.0),
    "doc_number": (6.0, 86.0, 88.0, 10.0),
    "qr_code": (72.0, 54.0, 24.0, 30.0),
}

PASSPORT_ZONES: dict[str, tuple[float, float, float, float]] = {
    "portrait": (4.0, 18.0, 24.0, 48.0),
    "name": (30.0, 26.0, 64.0, 22.0),
    "dob": (30.0, 48.0, 36.0, 8.0),
    "doc_number": (58.0, 4.0, 38.0, 10.0),
    "mrz": (2.0, 82.0, 96.0, 16.0),
}


def detect_document_bounds(image_bgr: np.ndarray) -> tuple[int, int, int, int]:
    """
    Find the largest document-like rectangle in the photo.
    Returns (x, y, width, height) in pixels; falls back to full image.
    """
    h, w = image_bgr.shape[:2]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    edges = cv2.dilate(edges, kernel, iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    img_area = h * w
    best: tuple[int, int, int, int] | None = None
    best_area = 0.0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < img_area * 0.12:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        aspect = bw / max(bh, 1)
        # ID pages: landscape card or portrait full letter scan
        if aspect > 2.8 or aspect < 0.35:
            continue
        if area > best_area:
            best_area = area
            best = (x, y, bw, bh)

    if best is None:
        return 0, 0, w, h
    return best


def zone_in_document_bounds(
    zone: tuple[float, float, float, float],
    doc_x: int,
    doc_y: int,
    doc_w: int,
    doc_h: int,
    img_w: int,
    img_h: int,
) -> tuple[float, float, float, float]:
    """Map zone % inside document bounds → % of full image."""
    zx, zy, zw, zh = zone
    left = doc_x + (zx / 100.0) * doc_w
    top = doc_y + (zy / 100.0) * doc_h
    width = (zw / 100.0) * doc_w
    height = (zh / 100.0) * doc_h
    pl = max(0.0, min(98.0, left / img_w * 100))
    pt = max(0.0, min(98.0, top / img_h * 100))
    pw = min(100.0 - pl, max(2.0, width / img_w * 100))
    ph = min(100.0 - pt, max(2.0, height / img_h * 100))
    return round(pl, 2), round(pt, 2), round(pw, 2), round(ph, 2)


def get_layout_zones(document_type: str) -> dict[str, tuple[float, float, float, float]]:
    if document_type == "passport":
        return PASSPORT_ZONES
    if document_type == "aadhaar":
        return AADHAAR_ZONES
    return {}
