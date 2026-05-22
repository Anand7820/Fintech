from pathlib import Path

import cv2
import numpy as np

from app.core.config import Settings
from app.models.schemas import LayoutAnalysis


def analyze_layout(image_bgr: np.ndarray, settings: Settings) -> LayoutAnalysis:
    """
    Template matching against reference document layouts.
    Uses normalized cross-correlation on edge maps.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150)

    templates = _load_templates(settings.templates_dir)
    if not templates:
        templates = _synthetic_templates()

    best_name: str | None = None
    best_score = 0.0

    for name, template_edges in templates.items():
        resized = _resize_to_template(edges, template_edges.shape[::-1])
        if resized.shape[0] < template_edges.shape[0] or resized.shape[1] < template_edges.shape[1]:
            continue
        result = cv2.matchTemplate(resized, template_edges, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, _ = cv2.minMaxLoc(result)
        if float(max_val) > best_score:
            best_score = float(max_val)
            best_name = name

    structural_integrity = best_score >= settings.layout_match_threshold
    return LayoutAnalysis(
        template_matched=best_name,
        layout_match_score=round(best_score, 4),
        structural_integrity=structural_integrity,
    )


def _load_templates(directory: Path) -> dict[str, np.ndarray]:
    templates: dict[str, np.ndarray] = {}
    if not directory.exists():
        return templates

    for path in directory.glob("*.png"):
        img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
        edges = cv2.Canny(cv2.GaussianBlur(img, (5, 5), 0), 50, 150)
        templates[path.stem] = edges
    return templates


def _synthetic_templates() -> dict[str, np.ndarray]:
    """Built-in edge-layout proxies when no template assets are present."""
    templates: dict[str, np.ndarray] = {}
    specs = {
        "passport": (400, 250),
        "drivers_license": (400, 250),
        "utility_bill": (400, 280),
    }
    for name, (h, w) in specs.items():
        canvas = np.zeros((h, w), dtype=np.uint8)
        cv2.rectangle(canvas, (10, 10), (w - 10, h - 10), 255, 2)
        cv2.rectangle(canvas, (20, 40), (140, 200), 255, 2)
        cv2.rectangle(canvas, (160, 40), (w - 20, 120), 255, 2)
        templates[name] = cv2.Canny(canvas, 50, 150)
    return templates


def _resize_to_template(image: np.ndarray, target_wh: tuple[int, int]) -> np.ndarray:
    target_w, target_h = target_wh
    h, w = image.shape[:2]
    scale = min(target_w / max(w, 1), target_h / max(h, 1))
    new_w = max(int(w * scale), 1)
    new_h = max(int(h * scale), 1)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
