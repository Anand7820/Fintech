import re
from dataclasses import dataclass

import cv2
import numpy as np
import pytesseract
from pytesseract import Output

from app.core.config import Settings
from app.core.exceptions import OCRProcessingError
from app.models.schemas import ExtractedFields, OCRResult


@dataclass
class _OCRParseResult:
    fields: ExtractedFields
    confidence: float
    raw_text: str


def extract_text(image_bgr: np.ndarray, settings: Settings) -> OCRResult:
    """Run Tesseract OCR and parse Name, DOB, and Document ID heuristically."""
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    enhanced = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11
    )

    try:
        data = pytesseract.image_to_data(
            enhanced,
            lang=settings.ocr_lang,
            output_type=Output.DICT,
            config="--psm 6",
        )
        raw_text = pytesseract.image_to_string(enhanced, lang=settings.ocr_lang, config="--psm 6")
    except pytesseract.TesseractNotFoundError as exc:
        raise OCRProcessingError(
            "Tesseract OCR is not installed. Install tesseract-ocr on the host system.",
            code="tesseract_missing",
        ) from exc
    except Exception as exc:
        raise OCRProcessingError(
            "OCR engine failed to process document.",
            code="ocr_failed",
        ) from exc

    confidences = [
        float(c) for c in data.get("conf", []) if str(c).lstrip("-").isdigit() and int(c) >= 0
    ]
    avg_confidence = float(np.mean(confidences)) if confidences else 0.0

    parsed = _parse_fields(raw_text.strip())
    return OCRResult(
        fields=parsed.fields,
        ocr_confidence=round(min(100.0, max(0.0, avg_confidence)), 2),
        raw_text_snippet=parsed.raw_text[:2000],
    )


def _parse_fields(text: str) -> _OCRParseResult:
    normalized = re.sub(r"\s+", " ", text.upper())

    document_id = _extract_document_id(normalized)
    date_of_birth = _extract_dob(normalized)
    name = _extract_name(normalized, document_id, date_of_birth)

    return _OCRParseResult(
        fields=ExtractedFields(
            name=name,
            date_of_birth=date_of_birth,
            document_id=document_id,
        ),
        confidence=0.0,
        raw_text=text,
    )


def _extract_document_id(text: str) -> str | None:
    patterns = [
        r"\b(?:DL|LIC|LICENSE|PASSPORT|DOC|ID)[\s#:]*([A-Z0-9\-]{6,20})\b",
        r"\bP<?\s*([0-9]{8,12})\b",
        r"\b([A-Z]{1,2}[0-9]{7,12})\b",
        r"\b(?:ACCOUNT|ACCT)[\s#:]*([0-9\-]{8,20})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
    return None


def _extract_dob(text: str) -> str | None:
    patterns = [
        r"\b(?:DOB|D\.O\.B|DATE OF BIRTH|BIRTH)[\s:]*([0-9]{1,2}[\s/\-][A-Z]{3}[\s/\-][0-9]{2,4})\b",
        r"\b([0-9]{1,2}[\s/\-](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\s/\-][0-9]{2,4})\b",
        r"\b([0-9]{2}[/-][0-9]{2}[/-][0-9]{4})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).strip()
    return None


def _extract_name(text: str, document_id: str | None, dob: str | None) -> str | None:
    patterns = [
        r"(?:SURNAME|GIVEN NAMES|FULL NAME|NAME)[\s/:]*([A-Z][A-Z\s\-]{2,40})",
        r"\b([A-Z]{2,15}\s+[A-Z]{2,15}(?:\s+[A-Z]{2,15})?)\b",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text):
            candidate = match.group(1).strip()
            if document_id and document_id in candidate:
                continue
            if dob and dob.replace(" ", "") in candidate.replace(" ", ""):
                continue
            if len(candidate) >= 5:
                return candidate.title()
    return None
