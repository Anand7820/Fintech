"""Aadhaar number validation (Verhoeff) and OCR error correction."""

from __future__ import annotations

import re

# Verhoeff multiplication / permutation tables
_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]
_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

# Common OCR confusions on printed Aadhaar numbers
_OCR_SWAP = {"O": "0", "o": "0", "I": "1", "l": "1", "S": "5", "s": "5", "B": "8"}


def verhoeff_valid(number: str) -> bool:
    if not number.isdigit() or len(number) != 12:
        return False
    if number[0] in "01":
        return False
    c = 0
    for i, ch in enumerate(reversed(number)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


def normalize_aadhaar(raw: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-z]", "", raw)
    for old, new in _OCR_SWAP.items():
        cleaned = cleaned.replace(old, new)
    return re.sub(r"\D", "", cleaned)


def _fix_single_digit_errors(number: str) -> str | None:
    """Try single-digit substitutions when Verhoeff fails (common on glare photos)."""
    if verhoeff_valid(number):
        return number
    confusions = (
        ("9", "5"),
        ("5", "9"),
        ("6", "5"),
        ("5", "6"),
        ("8", "3"),
        ("3", "8"),
        ("0", "6"),
        ("6", "0"),
    )
    for i in range(12):
        original = number[i]
        for a, b in confusions:
            if number[i] != a:
                continue
            candidate = number[:i] + b + number[i + 1 :]
            if verhoeff_valid(candidate):
                return candidate
    return None


def extract_aadhaar_number(text: str) -> tuple[str | None, bool]:
    """
    Return (12-digit Aadhaar, checksum_valid).
    Prefers numbers near 'AADHAAR' keyword; fixes OCR digit errors when possible.
    """
    upper = text.upper()
    candidates: list[str] = []

    for match in re.finditer(
        r"(?:AADHAAR|ADHAR|आधार|UID)[^\d]{0,30}(\d[\d\s]{10,14})",
        upper,
        re.IGNORECASE,
    ):
        candidates.append(normalize_aadhaar(match.group(1)))

    for match in re.finditer(r"\b(\d{4}\s?\d{4}\s?\d{4})\b", text):
        candidates.append(normalize_aadhaar(match.group(1)))

    for match in re.finditer(r"\b(\d{12})\b", re.sub(r"\s", "", text)):
        candidates.append(match.group(1))

    seen: set[str] = set()
    for raw in candidates:
        if len(raw) != 12 or raw in seen:
            continue
        seen.add(raw)
        if verhoeff_valid(raw):
            return raw, True
        fixed = _fix_single_digit_errors(raw)
        if fixed:
            return fixed, True

    if candidates:
        best = candidates[0]
        if len(best) == 12:
            return best, False
    return None, False


def is_aadhaar_document(text: str) -> bool:
    markers = (
        "AADHAAR",
        "ADHAR",
        "UIDAI",
        "UNIQUE IDENTIFICATION",
        "GOVERNMENT OF INDIA",
        "आधार",
        "माझे आधार",
    )
    upper = text.upper()
    return any(m in upper for m in markers) or bool(
        re.search(r"\d{4}\s?\d{4}\s?\d{4}", text)
    )
