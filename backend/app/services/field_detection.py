"""
Automatic field region detection from OCR word positions + face detection.
Works for any document size/layout (Aadhaar, PAN, passport, license).
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import cv2
import numpy as np

from app.core.config import Settings
from app.models.schemas import DetectedRegion, ExtractedFields
from app.services.ocr.aadhaar import is_plausible_person_name
from app.services.document_layout import (
    detect_document_bounds,
    get_layout_zones,
    zone_in_document_bounds,
)

try:
    import pytesseract

    _HAS_TESS = True
except ImportError:
    _HAS_TESS = False


@dataclass
class _WordBox:
    text: str
    left: int
    top: int
    width: int
    height: int
    conf: float


def _configure_tesseract(settings: Settings) -> None:
    if not _HAS_TESS:
        return
    import shutil

    path = settings.tesseract_cmd or shutil.which("tesseract")
    if path:
        pytesseract.pytesseract.tesseract_cmd = path


def _preprocess(gray: np.ndarray) -> np.ndarray:
    h, w = gray.shape[:2]
    if max(h, w) < 1400:
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _extract_word_boxes(image_bgr: np.ndarray, settings: Settings) -> list[_WordBox]:
    if not _HAS_TESS:
        return []
    _configure_tesseract(settings)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    scale = 1.0
    h, w = gray.shape[:2]
    if max(h, w) < 1400:
        scale = 2.0
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    data = pytesseract.image_to_data(
        gray,
        lang=settings.ocr_lang,
        output_type=pytesseract.Output.DICT,
        config="--psm 11",
    )
    words: list[_WordBox] = []
    n = len(data.get("text", []))
    for i in range(n):
        text = str(data["text"][i]).strip()
        if not text or len(text) < 1:
            continue
        try:
            conf = float(data["conf"][i])
        except (ValueError, TypeError):
            conf = -1
        if conf < 25:
            continue
        w = int(data["width"][i])
        h = int(data["height"][i])
        if w < 3 or h < 3:
            continue
        words.append(
            _WordBox(
                text=text,
                left=int(int(data["left"][i]) / scale),
                top=int(int(data["top"][i]) / scale),
                width=max(1, int(w / scale)),
                height=max(1, int(h / scale)),
                conf=conf,
            )
        )
    return words


def _detect_faces(image_bgr: np.ndarray) -> list[tuple[int, int, int, int]]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(40, 40))
    return [(int(x), int(y), int(w), int(h)) for x, y, w, h in faces]


def _pct_box(
    left: int, top: int, width: int, height: int, img_w: int, img_h: int, pad: float = 1.5
) -> tuple[float, float, float, float]:
    """Pixel box → percentage with small padding."""
    pl = max(0.0, min(98.0, (left - pad) / img_w * 100))
    pt = max(0.0, min(98.0, (top - pad) / img_h * 100))
    pw = min(100.0 - pl, max(2.0, (width + 2 * pad) / img_w * 100))
    ph = min(100.0 - pt, max(2.0, (height + 2 * pad) / img_h * 100))
    return round(pl, 2), round(pt, 2), round(pw, 2), round(ph, 2)


def _union_words(
    words: list[_WordBox], img_w: int, img_h: int, pad: float = 2.0
) -> tuple[float, float, float, float] | None:
    if not words:
        return None
    left = min(w.left for w in words)
    top = min(w.top for w in words)
    right = max(w.left + w.width for w in words)
    bottom = max(w.top + w.height for w in words)
    return _pct_box(left, top, right - left, bottom - top, img_w, img_h, pad)


def _normalize_token(t: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", t.upper())


def _words_matching_value(
    words: list[_WordBox], value: str, *, min_token_len: int = 2
) -> list[_WordBox]:
    if not value:
        return []
    value_tokens = [_normalize_token(t) for t in value.split() if len(_normalize_token(t)) >= min_token_len]
    if not value_tokens:
        return []

    matched: list[_WordBox] = []
    for word in words:
        wt = _normalize_token(word.text)
        if len(wt) < min_token_len:
            continue
        for vt in value_tokens:
            if wt == vt or (len(wt) >= 4 and len(vt) >= 4 and (wt in vt or vt in wt)):
                matched.append(word)
                break

    # Date: also match dd/mm/yyyy split across tokens
    if re.match(r"\d{2}/\d{2}/\d{4}", value):
        date_parts = value.replace("/", " ").split()
        for word in words:
            if word.text.strip() in date_parts or value.replace("/", "") in _normalize_token(word.text):
                matched.append(word)
    return matched


def _words_matching_regex(words: list[_WordBox], pattern: str) -> list[_WordBox]:
    rx = re.compile(pattern, re.IGNORECASE)
    return [w for w in words if rx.search(w.text)]


def _find_label_region(words: list[_WordBox], labels: tuple[str, ...], img_w: int, img_h: int) -> tuple[float, float, float, float] | None:
    label_words = [
        w for w in words if any(lb in w.text.upper() for lb in labels)
    ]
    if not label_words:
        return None
    return _union_words(label_words, img_w, img_h, pad=4.0)


def _refine_zone_with_words(
    zone_pct: tuple[float, float, float, float],
    words: list[_WordBox],
    img_w: int,
    img_h: int,
    *,
    value: str | None = None,
) -> tuple[float, float, float, float]:
    """Shrink template zone to OCR words inside it when possible."""
    zx, zy, zw, zh = zone_pct
    z_left = zx / 100 * img_w
    z_top = zy / 100 * img_h
    z_right = z_left + zw / 100 * img_w
    z_bottom = z_top + zh / 100 * img_h

    inside: list[_WordBox] = []
    for w in words:
        cx = w.left + w.width / 2
        cy = w.top + w.height / 2
        if z_left <= cx <= z_right and z_top <= cy <= z_bottom:
            if value:
                inside.extend(_words_matching_value([w], value))
            else:
                inside.append(w)

    if inside:
        refined = _union_words(inside, img_w, img_h, pad=4.0)
        if refined:
            return refined
    return zone_pct


def _layout_regions(
    image_bgr: np.ndarray,
    document_type: str,
    fields: ExtractedFields,
    words: list[_WordBox],
    *,
    faces: list[tuple[int, int, int, int]] | None = None,
) -> list[DetectedRegion]:
    """Card-sized template zones scaled to detected document bounds."""
    img_h, img_w = image_bgr.shape[:2]
    zones = get_layout_zones(document_type)
    if not zones:
        return []

    doc_x, doc_y, doc_w, doc_h = detect_document_bounds(image_bgr)
    doc_labels = {
        "aadhaar": "Aadhaar Number",
        "passport": "Passport Number",
        "pan": "PAN Number",
        "license": "License Number",
    }
    labels = {
        "portrait": "Photo",
        "name": "Name",
        "dob": "Date of Birth",
        "gender": "Gender",
        "doc_number": doc_labels.get(document_type, "Document ID"),
        "father_name": "Father's Name",
        "expiry": "Expiry Date",
        "qr_code": "QR Code",
        "mrz": "Machine Readable Zone",
    }
    regions: list[DetectedRegion] = []

    # Full document = detected card bounds
    regions.append(
        DetectedRegion(
            field_key="full_document",
            label="Document card",
            x=round(doc_x / img_w * 100, 2),
            y=round(doc_y / img_h * 100, 2),
            width=round(doc_w / img_w * 100, 2),
            height=round(doc_h / img_h * 100, 2),
            confidence=95.0,
        )
    )

    value_map = {
        "name": fields.name if is_plausible_person_name(fields.name) else None,
        "dob": fields.date_of_birth,
        "doc_number": fields.document_id,
        "father_name": fields.given_names,
        "expiry": fields.expiry_date,
    }

    field_keys = {
        "father_name": "given_names",
        "expiry": "expiry_date",
    }

    for key, zone in zones.items():
        if key == "qr_code" and document_type != "aadhaar":
            continue
        if key == "mrz" and document_type != "passport":
            continue
        if key == "gender" and document_type not in ("aadhaar",):
            continue
        if key == "father_name" and document_type != "pan":
            continue
        if key == "expiry" and document_type != "license":
            continue
        pct = zone_in_document_bounds(zone, doc_x, doc_y, doc_w, doc_h, img_w, img_h)
        if key == "portrait" and faces:
            faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
            x, y, fw, fh = faces[0]
            pct = _pct_box(x, y, fw, fh, img_w, img_h, pad=6.0)
        elif key in value_map and value_map.get(key):
            refined = _refine_zone_with_words(pct, words, img_w, img_h, value=value_map.get(key))
            # Keep template size if word match is too small (bad OCR)
            if refined[2] >= pct[2] * 0.35 and refined[3] >= pct[3] * 0.35:
                pct = refined
        regions.append(
            DetectedRegion(
                field_key=field_keys.get(key, key),
                label=f"{labels.get(key, key)} (on card)",
                x=pct[0],
                y=pct[1],
                width=pct[2],
                height=pct[3],
                confidence=88.0,
            )
        )
    return regions


def detect_field_regions(
    image_bgr: np.ndarray,
    settings: Settings,
    fields: ExtractedFields,
    document_type: str,
) -> list[DetectedRegion]:
    """
    Build overlay regions from document card layout + optional OCR refinement.
    """
    img_h, img_w = image_bgr.shape[:2]
    words = _extract_word_boxes(image_bgr, settings)

    faces = _detect_faces(image_bgr)

    if document_type in ("aadhaar", "passport", "pan", "license"):
        layout = _layout_regions(
            image_bgr, document_type, fields, words, faces=faces
        )
        if layout:
            return layout

    regions: list[DetectedRegion] = []

    regions.append(
        DetectedRegion(
            field_key="full_document",
            label="Document (auto-detected)",
            x=0.5,
            y=0.5,
            width=99.0,
            height=99.0,
            confidence=100.0,
        )
    )

    # Portrait — largest face on document
    if faces:
        faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w, h = faces[0]
        px, py, pw, ph = _pct_box(x, y, w, h, img_w, img_h, pad=8.0)
        regions.append(
            DetectedRegion(
                field_key="portrait",
                label="Photo (auto-detected)",
                x=px,
                y=py,
                width=pw,
                height=ph,
                confidence=90.0,
            )
    )

    # Name / passport identity block
    name_targets = [fields.name]
    if getattr(fields, "surname", None):
        name_targets.append(fields.surname)
    if getattr(fields, "given_names", None):
        name_targets.append(fields.given_names)
    name_words: list[_WordBox] = []
    for target in name_targets:
        if target:
            name_words.extend(_words_matching_value(words, target))
    if not name_words and fields.name:
        name_words = _longest_name_line(words)
    if name_words:
        box = _union_words(name_words, img_w, img_h, pad=6.0)
        if box:
            label = (
                "Surname & Given Names (auto-detected)"
                if document_type == "passport"
                else "Name (auto-detected)"
            )
            regions.append(
                DetectedRegion(
                    field_key="name",
                    label=label,
                    x=box[0],
                    y=box[1],
                    width=box[2],
                    height=box[3],
                    confidence=85.0,
                )
            )

    if document_type == "passport":
        sur_box = _find_label_region(words, ("SURNAME",), img_w, img_h)
        if sur_box:
            regions.append(
                DetectedRegion(
                    field_key="surname",
                    label="Surname (auto-detected)",
                    x=sur_box[0],
                    y=sur_box[1],
                    width=sur_box[2],
                    height=sur_box[3],
                    confidence=78.0,
                )
            )
        given_box = _find_label_region(words, ("GIVEN",), img_w, img_h)
        if given_box:
            regions.append(
                DetectedRegion(
                    field_key="given_names",
                    label="Given Names (auto-detected)",
                    x=given_box[0],
                    y=given_box[1],
                    width=given_box[2],
                    height=given_box[3],
                    confidence=78.0,
                )
            )
        mrz_box = _find_mrz_region(image_bgr, img_w, img_h)
        if mrz_box:
            regions.append(
                DetectedRegion(
                    field_key="mrz",
                    label="Machine Readable Zone (auto-detected)",
                    x=mrz_box[0],
                    y=mrz_box[1],
                    width=mrz_box[2],
                    height=mrz_box[3],
                    confidence=80.0,
                )
            )

    # DOB region
    if fields.date_of_birth:
        dob_words = _words_matching_value(words, fields.date_of_birth, min_token_len=1)
        if not dob_words:
            dob_words = _words_matching_regex(words, r"\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}")
        box = _union_words(dob_words, img_w, img_h, pad=5.0)
        if box:
            regions.append(
                DetectedRegion(
                    field_key="dob",
                    label="Date of Birth (auto-detected)",
                    x=box[0],
                    y=box[1],
                    width=box[2],
                    height=box[3],
                    confidence=82.0,
                )
            )

    # Document ID — Aadhaar / PAN / passport number on image
    if fields.document_id:
        id_clean = re.sub(r"\s", "", fields.document_id)
        id_words = _words_matching_value(words, fields.document_id.replace(" ", ""), min_token_len=3)
        if not id_words:
            # Try grouped digits (Aadhaar often split 5636 1349 3016)
            for w in words:
                if re.sub(r"\D", "", w.text) and len(re.sub(r"\D", "", w.text)) >= 4:
                    chunk = re.sub(r"\D", "", w.text)
                    if chunk in id_clean or id_clean in chunk:
                        id_words.append(w)
        if not id_words:
            id_words = _words_matching_regex(
                words,
                r"\d{4}\s?\d{4}\s?\d{4}|[A-Z]{5}\d{4}[A-Z]|\bP\d{7,9}\b",
            )
        box = _union_words(id_words, img_w, img_h, pad=6.0)
        if box:
            if document_type == "aadhaar":
                label = "Aadhaar Number (auto-detected)"
            elif document_type == "passport":
                label = "Passport Number (auto-detected)"
            else:
                label = "Document ID (auto-detected)"
            regions.append(
                DetectedRegion(
                    field_key="doc_number",
                    label=f"{label} (auto-detected)",
                    x=box[0],
                    y=box[1],
                    width=box[2],
                    height=box[3],
                    confidence=88.0,
                )
            )

    # Gender label area
    gender_box = _find_label_region(words, ("MALE", "FEMALE", "पुरुष", "स्त्री"), img_w, img_h)
    if gender_box:
        regions.append(
            DetectedRegion(
                field_key="gender",
                label="Gender (auto-detected)",
                x=gender_box[0],
                y=gender_box[1],
                width=gender_box[2],
                height=gender_box[3],
                confidence=75.0,
            )
    )

    # QR code — optional opencv detect
    qr_box = _detect_qr_region(image_bgr, img_w, img_h)
    if qr_box:
        regions.append(
            DetectedRegion(
                field_key="qr_code",
                label="QR Code (auto-detected)",
                x=qr_box[0],
                y=qr_box[1],
                width=qr_box[2],
                height=qr_box[3],
                confidence=80.0,
            )
        )

    return regions


def _longest_name_line(words: list[_WordBox]) -> list[_WordBox]:
    """Group words into lines by Y, pick best name-like line."""
    if not words:
        return []
    lines: dict[int, list[_WordBox]] = {}
    for w in words:
        key = w.top // 15
        lines.setdefault(key, []).append(w)

    best: list[_WordBox] = []
    best_score = 0
    stop = {"GOVERNMENT", "INDIA", "AADHAAR", "UNIQUE", "YOUR", "MALE", "FEMALE", "DOB", "DATE"}

    for line_words in lines.values():
        line_words = sorted(line_words, key=lambda w: w.left)
        alpha = [w for w in line_words if re.match(r"^[A-Za-z]{2,}$", w.text)]
        if len(alpha) < 2:
            continue
        if any(w.text.upper() in stop for w in alpha):
            continue
        score = sum(len(w.text) for w in alpha)
        if score > best_score:
            best_score = score
            best = alpha
    return best


def _find_mrz_region(
    image_bgr: np.ndarray, img_w: int, img_h: int
) -> tuple[float, float, float, float] | None:
    """Bottom strip where MRZ typically lives on passport pages."""
    h = image_bgr.shape[0]
    strip = image_bgr[int(h * 0.82) : h, :]
    if strip.size == 0:
        return None
    return _pct_box(0, int(h * 0.82), img_w, int(h * 0.18), img_w, img_h, pad=2.0)


def _detect_qr_region(
    image_bgr: np.ndarray, img_w: int, img_h: int
) -> tuple[float, float, float, float] | None:
    try:
        detector = cv2.QRCodeDetector()
        _, points, _ = detector.detectAndDecode(image_bgr)
        if points is None or len(points) == 0:
            return None
        pts = points[0].astype(int)
        left, top = pts.min(axis=0)
        right, bottom = pts.max(axis=0)
        return _pct_box(
            int(left), int(top), int(right - left), int(bottom - top), img_w, img_h, pad=4.0
        )
    except Exception:
        return None
