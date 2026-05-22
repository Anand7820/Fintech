"""Region-based OCR for Indian passport booklet pages (MRZ + labelled fields)."""

from __future__ import annotations

import re

import cv2
import numpy as np

from app.core.config import Settings
from app.models.schemas import ExtractedFields
from .aadhaar import is_dashboard_screenshot_text, is_plausible_person_name
from app.utils.passport import (
    combine_passport_name,
    extract_passport_number,
    is_blocked_passport_name,
    is_passport_document,
    parse_td3_mrz,
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
    h, w = gray.shape[:2]
    if max(h, w) < 900:
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _ocr_region(gray: np.ndarray, settings: Settings, *, psm: int = 6) -> str:
    if not _HAS_TESS:
        return ""
    _configure_tesseract(settings)
    return pytesseract.image_to_string(
        gray,
        lang=settings.ocr_lang,
        config=f"--psm {psm} -c preserve_interword_spaces=1",
    )


def _crop_passport_regions(image_bgr: np.ndarray) -> dict[str, np.ndarray]:
    """Indian passport page: photo left, data centre-right, MRZ bottom."""
    h, w = image_bgr.shape[:2]
    return {
        "full": image_bgr,
        "data_panel": image_bgr[int(h * 0.15) : int(h * 0.80), int(w * 0.30) : int(w * 0.98)],
        "mrz_strip": image_bgr[int(h * 0.78) : h, int(w * 0.02) : int(w * 0.98)],
        "header": image_bgr[0 : int(h * 0.22), :],
    }


def _parse_labelled_fields(text: str) -> dict[str, str | None]:
    upper = text.upper().replace("\r", "\n")
    out: dict[str, str | None] = {
        "surname": None,
        "given_names": None,
        "document_id": None,
        "date_of_birth": None,
        "nationality": None,
    }

    sur = re.search(
        r"SURNAME[:\s/]*\n\s*([A-Z][A-Z\-]{2,24})\b",
        upper,
    )
    if not sur:
        sur = re.search(r"SURNAME[:\s/]+([A-Z][A-Z\-]{2,24})\b", upper)
    if sur:
        cand = re.sub(r"\s+", " ", sur.group(1)).strip()
        if _valid_field_token(cand):
            out["surname"] = cand.title()

    given = re.search(
        r"GIVEN\s*NAME(?:S)?[:\s/]*\n\s*([A-Z][A-Z\s\-]{2,35}?)\s*\n",
        upper,
    )
    if not given:
        given = re.search(
            r"GIVEN\s*NAME(?:S)?[:\s/]+([A-Z][A-Z\s\-]{2,35}?)(?:\s*\n|\s+NATIONALITY|\s+DATE)",
            upper,
        )
    if given:
        cand = re.sub(r"\s+", " ", given.group(1)).strip()
        if _valid_field_token(cand):
            out["given_names"] = cand.title()

    pno = re.search(
        r"(?:PASSPORT\s*(?:NO|NUMBER)?|FILE\s*NO|नं\.?)[:\s#]*([A-Z][A-Z0-9]{6,9})",
        upper,
    )
    if pno:
        out["document_id"] = pno.group(1).upper()

    if not out["document_id"]:
        alt = re.search(r"\b([A-Z]\d{7,8})\b", upper)
        if alt:
            out["document_id"] = alt.group(1)

    dob = re.search(
        r"(?:DATE\s*OF\s*BIRTH|DOB|जन्म)[:\s/]*(\d{2}/\d{2}/\d{4})",
        upper,
    )
    if dob:
        out["date_of_birth"] = dob.group(1)

    if not out["date_of_birth"]:
        dob2 = re.search(r"\b(\d{2}/\d{2}/\d{4})\b", upper)
        if dob2:
            d, m, y = dob2.group(1).split("/")
            if 1990 <= int(y) <= 2015:
                out["date_of_birth"] = dob2.group(1)

    if "INDIAN" in upper or "NATIONALITY" in upper:
        out["nationality"] = "INDIAN"

    return out


def _valid_field_token(value: str) -> bool:
    tokens = value.upper().split()
    if not tokens or len(tokens) > 5:
        return False
    blocked = {"REPUBLIC", "INDIA", "PASSPORT", "GOVERNMENT", "SURNAME", "GIVEN", "NAMES"}
    if any(t in blocked for t in tokens):
        return False
    return all(len(t) >= 2 and t.isalpha() for t in tokens)


def extract_passport_fields(
    image_bgr: np.ndarray,
    settings: Settings,
    fallback_text: str = "",
) -> tuple[ExtractedFields, float, str]:
    if is_dashboard_screenshot_text(fallback_text):
        raise ValueError("uploaded_image_looks_like_app_screenshot")

    regions = _crop_passport_regions(image_bgr)
    texts: dict[str, str] = {}
    confidences: list[float] = []

    for key, crop in regions.items():
        if crop.size == 0:
            continue
        gray = _enhance_region(crop)
        psm = 7 if key == "mrz_strip" else 6
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

    combined = "\n".join(texts.values()) + "\n" + fallback_text
    if is_dashboard_screenshot_text(combined):
        raise ValueError("uploaded_image_looks_like_app_screenshot")

    mrz = parse_td3_mrz(combined)
    labelled = _parse_labelled_fields(texts.get("data_panel", "") + "\n" + texts.get("full", ""))

    surname = mrz.get("surname") or labelled.get("surname")
    given = labelled.get("given_names") or mrz.get("given_names")
    if labelled.get("given_names") and mrz.get("given_names"):
        if len(labelled["given_names"]) >= len(mrz["given_names"]):
            given = labelled["given_names"]
    doc_id = (
        extract_passport_number(combined)
        or labelled.get("document_id")
        or mrz.get("document_id")
    )
    dob = labelled.get("date_of_birth") or mrz.get("date_of_birth")
    nationality = mrz.get("nationality") or labelled.get("nationality")

    name = combine_passport_name(surname, given)
    if name and (is_blocked_passport_name(name) or not is_plausible_person_name(name)):
        name = None
        if is_blocked_passport_name(surname):
            surname = None
        if is_blocked_passport_name(given):
            given = None
        name = combine_passport_name(surname, given)

    avg_conf = float(np.mean(confidences)) if confidences else 50.0
    if name and is_plausible_person_name(name):
        avg_conf = max(avg_conf, 72.0)
    if doc_id:
        avg_conf = max(avg_conf, 70.0)
    if dob:
        avg_conf = max(avg_conf, 68.0)

    fields = ExtractedFields(
        name=name,
        surname=surname,
        given_names=given,
        date_of_birth=dob,
        document_id=doc_id,
        nationality=nationality,
    )
    return fields, min(99.0, avg_conf), combined
