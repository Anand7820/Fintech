"""Region-based OCR for driver's license (US / generic layout)."""

from __future__ import annotations

import re

import cv2
import numpy as np

from app.core.config import Settings
from app.models.schemas import ExtractedFields
from .aadhaar import is_dashboard_screenshot_text, is_plausible_person_name
from app.utils.license_doc import (
    LICENSE_BLOCKLIST,
    extract_license_number,
    is_blocked_license_name,
    is_license_document,
)

try:
    import pytesseract

    _HAS_TESS = True
except ImportError:
    _HAS_TESS = False


def _configure_tesseract(settings: Settings) -> None:
    if not _HAS_TESS:
        return
    import shutil

    path = settings.tesseract_cmd or shutil.which("tesseract")
    if path:
        pytesseract.pytesseract.tesseract_cmd = path


def _enhance_region(crop: np.ndarray) -> np.ndarray:
    if len(crop.shape) == 3:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop
    if max(gray.shape[:2]) < 900:
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _ocr_region(gray: np.ndarray, settings: Settings, *, psm: int = 6) -> str:
    if not _HAS_TESS:
        return ""
    _configure_tesseract(settings)
    return pytesseract.image_to_string(
        gray, lang=settings.ocr_lang, config=f"--psm {psm} -c preserve_interword_spaces=1"
    )


def _crop_license_regions(image_bgr: np.ndarray) -> dict[str, np.ndarray]:
    """Horizontal ID: photo left, text block right."""
    h, w = image_bgr.shape[:2]
    landscape = w >= h
    if landscape:
        return {
            "full": image_bgr,
            "photo": image_bgr[int(h * 0.12) : int(h * 0.88), 0 : int(w * 0.32)],
            "details": image_bgr[int(h * 0.10) : int(h * 0.90), int(w * 0.30) : int(w * 0.98)],
        }
    return {
        "full": image_bgr,
        "photo": image_bgr[int(h * 0.15) : int(h * 0.55), int(w * 0.05) : int(w * 0.40)],
        "details": image_bgr[int(h * 0.10) : int(h * 0.85), int(w * 0.08) : int(w * 0.95)],
    }


def _parse_license_fields(text: str) -> dict[str, str | None]:
    upper = text.upper().replace("\r", "\n")
    out: dict[str, str | None] = {
        "name": None,
        "date_of_birth": None,
        "expiry": None,
        "license_id": None,
        "state": None,
    }

    lic = extract_license_number(upper)
    if lic:
        out["license_id"] = lic

    dob = re.search(
        r"(?:DOB|DATE\s*OF\s*BIRTH|BIRTH)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        upper,
    )
    if not dob:
        dob = re.search(
            r"(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{2,4})",
            upper,
        )
    if dob:
        out["date_of_birth"] = dob.group(1).strip()

    exp = re.search(
        r"(?:EXP|EXPIR(?:ES|Y)|VALID(?:ITY)?(?:\(NT\))?)[\s:]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        upper,
    )
    if exp:
        out["expiry"] = exp.group(1).strip()

    for pattern in (
        r"NAME[:\s]+([A-Z][A-Z \-']{4,40})",
        r"LN[:\s]+([A-Z][A-Z \-']{2,30})",
        r"(?:^|\n)\s*([A-Z][A-Z]+(?: [A-Z][A-Z]+){1,3})\s*\n",
    ):
        match = re.search(pattern, upper)
        if match:
            cand = re.sub(r"\s+", " ", match.group(1)).strip()
            if _valid_license_name(cand):
                out["name"] = cand.title()
                break

    state = re.search(
        r"\b(CALIFORNIA|NEW YORK|TEXAS|FLORIDA|MAHARASHTRA|KARNATAKA|DELHI)\b",
        upper,
    )
    if state:
        out["state"] = state.group(1).title()

    return out


def _valid_license_name(value: str) -> bool:
    if is_blocked_license_name(value):
        return False
    return is_plausible_person_name(value)


def extract_license_fields(
    image_bgr: np.ndarray,
    settings: Settings,
    fallback_text: str = "",
) -> tuple[ExtractedFields, float, str]:
    if is_dashboard_screenshot_text(fallback_text):
        raise ValueError("uploaded_image_looks_like_app_screenshot")

    regions = _crop_license_regions(image_bgr)
    texts: dict[str, str] = {}
    confidences: list[float] = []

    for key, crop in regions.items():
        if crop.size == 0:
            continue
        gray = _enhance_region(crop)
        text = _ocr_region(gray, settings, psm=6)
        texts[key] = text
        if _HAS_TESS and text.strip():
            try:
                data = pytesseract.image_to_data(
                    gray,
                    lang=settings.ocr_lang,
                    output_type=pytesseract.Output.DICT,
                    config="--psm 6",
                )
                confs = [
                    float(c)
                    for c in data.get("conf", [])
                    if str(c).replace("-", "").isdigit() and float(c) >= 0
                ]
                if confs:
                    confidences.append(float(np.mean(confs)))
            except Exception:
                pass

    combined = "\n".join(texts.values()) + "\n" + fallback_text
    if is_dashboard_screenshot_text(combined):
        raise ValueError("uploaded_image_looks_like_app_screenshot")

    parsed = _parse_license_fields(combined)
    name = parsed.get("name")
    if name and not _valid_license_name(name):
        name = None

    avg_conf = float(np.mean(confidences)) if confidences else 50.0
    if parsed.get("license_id"):
        avg_conf = max(avg_conf, 70.0)
    if name:
        avg_conf = max(avg_conf, 68.0)

    fields = ExtractedFields(
        name=name,
        date_of_birth=parsed.get("date_of_birth"),
        expiry_date=parsed.get("expiry"),
        document_id=parsed.get("license_id"),
        nationality=parsed.get("state"),
    )
    return fields, min(99.0, avg_conf), combined
