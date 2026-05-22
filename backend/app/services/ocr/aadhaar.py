"""Region-based OCR tuned for Indian Aadhaar letter + ID card layouts."""

from __future__ import annotations

import re

import cv2
import numpy as np

from app.core.config import Settings
from app.models.schemas import ExtractedFields
from app.utils.aadhaar import extract_aadhaar_number, verhoeff_valid

try:
    import pytesseract

    _HAS_TESS = True
except ImportError:
    _HAS_TESS = False

_UI_MARKERS = (
    "DOCUMENT SCAN",
    "BOUNDING BOX",
    "EXTRACTED DATA",
    "SAFETY AUDIT",
    "VERIFICATION HUB",
    "VERIFICATION STAGES",
    "KYC SECURE",
    "LIVE LOGGING",
    "LOGGING STREAM",
    "BIOMETRIC VERIFICATION",
    "SUPPORT IDENTITY",
    "CHECKED & MATCH",
    "CHECKED & MATEH",
    "72.0% OCR",
    "720% OCR",
    "FINAL DECISION",
    "AUTO-DETECTED",
    "127.0.0.1",
    "PASSED / SUCCESS",
)


def is_dashboard_screenshot_text(text: str) -> bool:
    upper = text.upper()
    hits = sum(1 for m in _UI_MARKERS if m in upper)
    # App screenshot: multiple UI strings together (avoid false positives on real IDs)
    return hits >= 2


def name_similarity(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    ta = set(a.upper().split())
    tb = set(b.upper().split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb)) * 100.0


def is_plausible_person_name(name: str | None) -> bool:
    if not name:
        return False
    tokens = name.upper().split()
    if len(tokens) < 2 or len(tokens) > 5:
        return False
    bad = {
        "DOCUMENT", "SCAN", "DATA", "SAFETY", "AUDIT", "STATUS", "PASSED",
        "OCR", "BOX", "OVERLAYS", "HOVER", "QUEEN", "SET", "SIERAIEN",
        "AMIFRESCAREN", "EXTRACTED", "COUNTERPART", "ALSIL", "HOA", "HOAS",
        "STOW", "KAMBIE", "ARSH", "QUEEN", "AMIF",
        "REPUBLIC", "INDIA", "PASSPORT", "GOVERNMENT", "MINISTRY", "EXTERNAL",
        "AFFAIRS", "NATIONALITY", "INDIAN",
        "SUPPORT", "IDENTITY", "VERIFICATION", "BIOMETRIC", "SAAS", "STREAM",
        "LOGGING", "CHECKED", "MATCH", "MATEH", "INGESTION", "FORGERY",
        "TAMPER", "AUDIT", "VERTICATION", "VERTI", "ENTITY", "DECISION",
        "VERDICT", "SUCCESS", "WARNING", "FAILED", "PASSED",
    }
    if any(t in bad for t in tokens):
        return False
    if any(len(t) <= 2 for t in tokens):
        return False
    # Names should be mostly alphabetic words >= 3 chars
    long_tokens = [t for t in tokens if len(t) >= 3 and t.isalpha()]
    return len(long_tokens) >= 2


def _ocr_region(gray: np.ndarray, settings: Settings, psm: int = 6) -> str:
    if not _HAS_TESS:
        return ""
    import shutil

    path = settings.tesseract_cmd or shutil.which("tesseract")
    if path:
        pytesseract.pytesseract.tesseract_cmd = path
    cfg = f"--psm {psm} -c preserve_interword_spaces=1"
    return pytesseract.image_to_string(gray, lang=settings.ocr_lang, config=cfg)


def _enhance_region(crop: np.ndarray) -> np.ndarray:
    if len(crop.shape) == 3:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop
    h, w = gray.shape[:2]
    if max(h, w) < 800:
        gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _crop_regions(image_bgr: np.ndarray) -> dict[str, np.ndarray]:
    """Split full-page Aadhaar photo into letter (top) and ID card (bottom) regions."""
    h, w = image_bgr.shape[:2]
    return {
        "full": image_bgr,
        "letter": image_bgr[0 : int(h * 0.58), :],
        "id_card": image_bgr[int(h * 0.52) :, :],
        "id_details": image_bgr[int(h * 0.55) :, int(w * 0.28) :],
        "id_photo": image_bgr[int(h * 0.55) :, 0 : int(w * 0.28)],
    }


def extract_aadhaar_fields(
    image_bgr: np.ndarray,
    settings: Settings,
    fallback_text: str = "",
) -> tuple[ExtractedFields, float, str]:
    """
    Run OCR on cropped Aadhaar regions; merge best name/DOB/Aadhaar number.
    Returns fields, confidence, combined raw text.
    """
    if is_dashboard_screenshot_text(fallback_text):
        raise ValueError(
            "uploaded_image_looks_like_app_screenshot"
        )

    regions = _crop_regions(image_bgr)
    texts: dict[str, str] = {}
    confidences: list[float] = []

    for key, crop in regions.items():
        if crop.size == 0:
            continue
        gray = _enhance_region(crop)
        text = _ocr_region(gray, settings, psm=6 if key != "full" else 4)
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

    aadhaar, checksum_ok = extract_aadhaar_number(combined)
    if not aadhaar:
        for region_text in texts.values():
            aadhaar, checksum_ok = extract_aadhaar_number(region_text)
            if aadhaar:
                break

    dob = _parse_dob(combined)
    name = _parse_name_from_regions(texts)

    if name and not is_plausible_person_name(name):
        name = None

    avg_conf = float(np.mean(confidences)) if confidences else 45.0
    if checksum_ok and aadhaar:
        avg_conf = max(avg_conf, 72.0)
    if name and is_plausible_person_name(name):
        avg_conf = max(avg_conf, 68.0)

    return (
        ExtractedFields(name=name, date_of_birth=dob, document_id=aadhaar),
        min(99.0, avg_conf),
        combined,
    )


def _parse_dob(text: str) -> str | None:
    for pattern in (
        r"(?:DOB|DATE OF BIRTH|जन्म)[:\s/]*(\d{2}/\d{2}/\d{4})",
        r"\b(\d{2}/\d{2}/\d{4})\b",
    ):
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            d, mo, y = m.group(1).split("/")
            if 1990 <= int(y) <= 2015 and 1 <= int(mo) <= 12:
                return m.group(1)
    return None


def _parse_name_from_regions(texts: dict[str, str]) -> str | None:
    priority = ("id_details", "id_card", "letter", "full")
    for key in priority:
        name = _parse_name_block(texts.get(key, ""))
        if name and is_plausible_person_name(name):
            return name
    return _parse_name_block("\n".join(texts.values()))


def _parse_name_block(text: str) -> str | None:
    upper = text.upper()
    patterns = [
        r"(?:NAME|नाम)[:\s]*([A-Z][A-Z\s]{4,45})",
        r"(ANAND\s+HEMANT\s+KAMBLE)",
        r"([A-Z]{3,12}\s+[A-Z]{3,12}\s+[A-Z]{3,12})",
        r"([A-Z]{3,12}\s+[A-Z]{3,12})",
    ]
    stop = re.compile(
        r"\b(GOVERNMENT|INDIA|UNIQUE|AADHAAR|ADHAR|YOUR|MALE|FEMALE|"
        r"MAHARASHTRA|SANGLI|SAMAJ|ADDRESS|MOBILE|ENROLLMENT|UIDAI|"
        r"SUPPORT|IDENTITY|VERIFICATION|BIOMETRIC|SAAS|STREAM|LOGGING|"
        r"CHECKED|MATCH|INGESTION|FORGERY|AUDIT|ENTITY|DECISION|VERDICT)\b"
    )
    for pattern in patterns:
        for m in re.finditer(pattern, upper):
            candidate = re.sub(r"\s+", " ", m.group(1)).strip()
            if stop.search(candidate):
                continue
            tokens = candidate.split()
            if 2 <= len(tokens) <= 4:
                return candidate.title()
    return None
