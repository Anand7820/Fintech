"""Driver's license detection and number parsing."""

from __future__ import annotations

import re

LICENSE_BLOCKLIST = frozenset(
    {
        "DRIVER",
        "LICENSE",
        "LICENCE",
        "DMV",
        "CALIFORNIA",
        "STATE",
        "USA",
        "UNITED",
        "STATES",
        "CLASS",
        "RESTRICTIONS",
        "ENDORSEMENTS",
        "EXPIRES",
        "ISSUED",
    }
)


def is_license_document(text: str) -> bool:
    upper = text.upper()
    if "DRIVER" in upper and "LICEN" in upper:
        return True
    if "DMV" in upper:
        return True
    if re.search(r"\bDL[\s\-]?\d{5,10}\b", upper):
        return True
    if "OPERATOR" in upper and "LICENSE" in upper:
        return True
    return False


def extract_license_number(text: str) -> str | None:
    upper = text.upper()
    patterns = (
        r"\b(DL\d{5,10})\b",
        r"(?:DL|LIC(?:ENSE)?(?:\s+NO)?|ID(?:\s+NO)?)[:\s#\-]*(DL?[A-Z0-9]{5,12})",
        r"\b([A-Z]{2}\d{6,10})\b",
        r"\b(\d{1}[ -]\d{3}[ -]\d{3}[ -]\d{3}[ -]\d)\b",
    )
    for pattern in patterns:
        match = re.search(pattern, upper)
        if match:
            return re.sub(r"[\s\-]", "", match.group(1))
    return None


def is_blocked_license_name(name: str | None) -> bool:
    if not name:
        return True
    tokens = name.upper().split()
    return any(t in LICENSE_BLOCKLIST for t in tokens)
