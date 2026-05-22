"""Indian PAN card detection and number parsing."""

from __future__ import annotations

import re

PAN_PATTERN = re.compile(r"\b([A-Z]{5})(\d{4})([A-Z])\b")

PAN_BLOCKLIST = frozenset(
    {
        "INCOME",
        "TAX",
        "DEPARTMENT",
        "GOVERNMENT",
        "INDIA",
        "PERMANENT",
        "ACCOUNT",
        "NUMBER",
        "SIGNATURE",
        "FATHER",
        "NAME",
        "DATE",
        "BIRTH",
    }
)


def is_pan_document(text: str) -> bool:
    upper = text.upper()
    if re.search(r"\b[A-Z]{5}\d{4}[A-Z]\b", upper):
        if "INCOME" in upper or "PERMANENT" in upper or "PAN" in upper or "आयकर" in text:
            return True
        if "FATHER" in upper and "NAME" in upper:
            return True
    return False


def extract_pan_number(text: str) -> str | None:
    upper = text.upper().replace(" ", "")
    for match in PAN_PATTERN.finditer(upper):
        pan = "".join(match.groups())
        if validate_pan_format(pan):
            return pan
    # OCR noise: O vs 0 in digit section
    for raw in re.finditer(r"[A-Z]{5}[0-9OIS]{4}[A-Z]", upper):
        candidate = raw.group(0)
        fixed = candidate[:5] + candidate[5:9].translate(str.maketrans("OIS", "015")) + candidate[9]
        if validate_pan_format(fixed):
            return fixed
    return None


def validate_pan_format(pan: str) -> bool:
    if len(pan) != 10:
        return False
    if not PAN_PATTERN.fullmatch(pan):
        return False
    # 4th character: P=person, C=company, etc.
    if pan[3] not in "PHGABCLFJTE":
        return False
    return True


def format_pan_display(pan: str) -> str:
    if len(pan) == 10:
        return f"{pan[:5]} {pan[5:9]} {pan[9]}"
    return pan
