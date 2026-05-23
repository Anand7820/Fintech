"""Region-based OCR for Indian PAN card."""

from __future__ import annotations

import re

import cv2
import numpy as np

from app.core.config import Settings
from app.models.schemas import ExtractedFields
from .aadhaar import is_dashboard_screenshot_text, is_plausible_person_name
from app.utils.pan import (
    PAN_BLOCKLIST,
    extract_pan_number,
    format_pan_display,
    is_pan_document,
    validate_pan_format,
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
    # Image is already denoised in preprocess_document; doing it again blurs the text heavily!
    if max(gray.shape[:2]) < 900:
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _ocr_region(gray: np.ndarray, settings: Settings, *, psm: int = 6) -> str:
    if not _HAS_TESS:
        return ""
    _configure_tesseract(settings)
    return pytesseract.image_to_string(
        gray, lang=settings.ocr_lang, config=f"--psm {psm} -c preserve_interword_spaces=1"
    )


def _crop_pan_regions(image_bgr: np.ndarray) -> dict[str, np.ndarray]:
    """PAN card: landscape, photo left, details right."""
    h, w = image_bgr.shape[:2]
    if w < h:
        # Portrait photo of card — card usually in center
        return {
            "full": image_bgr,
            "full_no_qr": image_bgr[: int(h * 0.85), : int(w * 0.95)],
            "photo": image_bgr[int(h * 0.25) : int(h * 0.75), 0 : int(w * 0.35)],
        }
    return {
        "full": image_bgr,
        "full_no_qr": image_bgr[:, : int(w * 0.68)],
        "details": image_bgr[
            int(h * 0.05) : int(h * 0.95), int(w * 0.25) : int(w * 0.65)
        ],
        "number_strip": image_bgr[
            int(h * 0.70) : int(h * 0.95), int(w * 0.05) : int(w * 0.95)
        ],
        "photo": image_bgr[int(h * 0.12) : int(h * 0.88), 0 : int(w * 0.25)],
    }


def _parse_pan_fields(text: str) -> dict[str, str | None]:
    upper = text.upper().replace("\r", "\n")
    out: dict[str, str | None] = {
        "name": None,
        "given_names": None,
        "father_name": None,
        "date_of_birth": None,
        "pan": None,
    }

    pan = extract_pan_number(upper)
    if pan:
        out["pan"] = format_pan_display(pan)

    dob = re.search(r"(\d{2}[/-]\d{2}[/-]\d{4})", upper)
    if dob:
        out["date_of_birth"] = dob.group(1)

    # Find all "FATHER...NAME" blocks
    father_matches = re.finditer(r"(?:^|\n).*?FATHE?R?[^\n]*NAME[^\n]*\n([\s\S]*?)(?=\n.*?(?:DATE|BIRTH|जन्म|PAN|INCOME|GOVT|\d{2}[/-]\d{2}[/-]\d{4}|$))", upper)
    father_candidates = []
    for fm in father_matches:
        valid_words = []
        for line in fm.group(1).splitlines():
            line = re.sub(r"[^A-Z\s]", "", line).strip()
            for w in line.split():
                if len(w) > 2 and w not in {"ART", "OON", "ARREA", "OONAH"}:
                    valid_words.append(w)
        cand = " ".join(valid_words)
        if len(cand) > 5 and _valid_name(cand):
            father_candidates.append(cand.title())
    
    if father_candidates:
        out["given_names"] = max(father_candidates, key=len)

    # Find all "NAME" blocks that don't contain "FATHER"
    name_matches = re.finditer(r"(?:^|\n)(?!.*FATHE?R?).*?(?:NAME|नाम)[^\n]*\n([\s\S]*?)(?=\n.*?(?:FATHE?R?|पिता|DATE|BIRTH|जन्म|PAN|INCOME|GOVT|\d{2}[/-]\d{2}[/-]\d{4}|$))", upper)
    name_candidates = []
    for nm in name_matches:
        valid_words = []
        for line in nm.group(1).splitlines():
            line = re.sub(r"[^A-Z\s]", "", line).strip()
            for w in line.split():
                if len(w) > 2 and w not in {"ART", "OON", "ARREA", "OONAH"}:
                    valid_words.append(w)
        cand = " ".join(valid_words)
        if len(cand) > 5 and _valid_name(cand):
            name_candidates.append(cand.title())
            
    if name_candidates:
        out["name"] = max(name_candidates, key=len)

    if not out["name"]:
        for line in upper.splitlines():
            line = line.strip()
            if not line or any(w in line for w in PAN_BLOCKLIST):
                continue
            tokens = line.split()
            if 2 <= len(tokens) <= 4 and all(t.isalpha() and len(t) >= 2 for t in tokens):
                if _valid_name(line):
                    out["name"] = line.title()
                    break

    return out


def _valid_name(value: str) -> bool:
    tokens = value.upper().split()
    if not tokens or len(tokens) > 5:
        return False
    if any(t in PAN_BLOCKLIST for t in tokens):
        return False
    return is_plausible_person_name(value)


def extract_pan_fields(
    image_bgr: np.ndarray,
    settings: Settings,
    fallback_text: str = "",
) -> tuple[ExtractedFields, float, str]:
    if is_dashboard_screenshot_text(fallback_text):
        raise ValueError("uploaded_image_looks_like_app_screenshot")

    regions = _crop_pan_regions(image_bgr)
    texts: dict[str, str] = {}
    confidences: list[float] = []

    for key, crop in regions.items():
        if crop.size == 0 or key == "photo":
            continue
        gray = _enhance_region(crop)
        if key == "number_strip":
            psm = 7
        elif key in ("full", "full_no_qr"):
            psm = 3
        else:
            psm = 6
        text = _ocr_region(gray, settings, psm=psm)
        texts[key] = text
        if _HAS_TESS and text.strip():
            try:
                data = pytesseract.image_to_data(
                    gray,
                    lang=settings.ocr_lang,
                    output_type=pytesseract.Output.DICT,
                    config=f"--psm {psm}",
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

    combined = "\n".join(texts.values())
    if not combined.strip():
        combined = fallback_text
    if is_dashboard_screenshot_text(combined):
        raise ValueError("uploaded_image_looks_like_app_screenshot")

    parsed = _parse_pan_fields(combined)
    pan = parsed.get("pan") or extract_pan_number(combined)
    if pan and validate_pan_format(pan.replace(" ", "")):
        pan = format_pan_display(pan.replace(" ", ""))

    name = parsed.get("name")
    if name and not is_plausible_person_name(name):
        name = None

    avg_conf = float(np.mean(confidences)) if confidences else 50.0
    if pan:
        avg_conf = max(avg_conf, 72.0)
    if name:
        avg_conf = max(avg_conf, 68.0)

    fields = ExtractedFields(
        name=name,
        given_names=parsed.get("given_names"),
        date_of_birth=parsed.get("date_of_birth"),
        document_id=pan,
        nationality="IND",
    )
    return fields, min(99.0, avg_conf), combined
