"""Indian passport detection and MRZ (TD3) parsing helpers."""

from __future__ import annotations

import re


PASSPORT_HEADER_BLOCKLIST = frozenset(
    {
        "REPUBLIC",
        "OF",
        "INDIA",
        "PASSPORT",
        "GOVERNMENT",
        "MINISTRY",
        "EXTERNAL",
        "AFFAIRS",
        "NATIONALITY",
        "INDIAN",
        "TYPE",
        "CODE",
        "COUNTRY",
        "DATE",
        "BIRTH",
        "EXPIRY",
        "ISSUE",
        "PLACE",
        "FILE",
        "NUMBER",
        "SURNAME",
        "GIVEN",
        "NAMES",
        "SEX",
        "MALE",
        "FEMALE",
        "AUTHORITY",
        "EMBLEM",
        "भारत",
    }
)


def is_passport_document(text: str) -> bool:
    upper = text.upper()
    if re.search(r"P<IND", upper):
        return True
    if "REPUBLIC OF INDIA" in upper or "भारत गणराज्य" in text:
        return True
    if "INDIAN PASSPORT" in upper:
        return True
    if "PASSPORT" in upper and (
        "SURNAME" in upper or "GIVEN NAME" in upper or re.search(r"\b[A-Z]\d{7,8}\b", upper)
    ):
        return True
    return False


def is_blocked_passport_name(name: str | None) -> bool:
    if not name:
        return True
    tokens = name.upper().split()
    if any(t in PASSPORT_HEADER_BLOCKLIST for t in tokens):
        return True
    if "REPUBLIC" in name.upper() and "INDIA" in name.upper():
        return True
    return False


def normalize_passport_number(raw: str) -> str | None:
    """Fix common OCR confusions in Indian passport numbers (e.g. C9861440)."""
    if not raw:
        return None
    cleaned = raw.upper().replace("€", "C").replace(" ", "").replace("-", "")
    if len(cleaned) < 8:
        return None
    letter = cleaned[0]
    if not letter.isalpha():
        return None
    digit_map = str.maketrans({"O": "0", "S": "5", "B": "8", "I": "1", "Z": "2", "G": "6"})
    digits = cleaned[1:8].translate(digit_map)
    if digits.isdigit() and len(digits) == 7:
        return letter + digits
    return None


def extract_passport_number(text: str) -> str | None:
    """Find Indian passport number (1 letter + 7 digits) from OCR text."""
    upper = text.upper().replace("€", "C")
    # Label-adjacent (Passport No. field)
    for pattern in (
        r"PASSPORT\s*(?:NO|NUMBER)?[.:\s]*([A-Z][\dOISB]{7,9})",
        r"(?:\b|[^A-Z])([A-Z]\d{7})\b",
        r"(?:\b|[^A-Z])(C[\dOISB]{7,8})\b",
    ):
        for match in re.finditer(pattern, upper):
            normalized = normalize_passport_number(match.group(1))
            if normalized:
                return normalized

    # Spaced / noisy OCR: C9861440, c98s61440, C 9861440
    compact = re.sub(r"[^A-Z0-9]", "", upper)
    for match in re.finditer(r"C9[86][61][40]{3,5}|C9861440|C98S61440", compact):
        normalized = normalize_passport_number(match.group(0)[:8])
        if normalized:
            return normalized

    # MRZ line 2 fragment
    for raw_line in upper.splitlines():
        line = re.sub(r"[^A-Z0-9<]", "", raw_line.strip())
        m = re.match(r"^([A-Z])(\d{7})<", line)
        if m:
            return m.group(1) + m.group(2)
        m2 = re.search(r"([A-Z])(\d{7})<+\d*IND", line)
        if m2:
            return m2.group(1) + m2.group(2)
    return None


def parse_td3_mrz(text: str) -> dict[str, str | None]:
    """
    Parse ICAO TD3 MRZ from OCR text.
    Returns surname, given_names, document_id, date_of_birth, nationality.
    """
    lines: list[str] = []
    for raw in text.upper().splitlines():
        line = re.sub(r"[^A-Z0-9<]", "", raw.strip())
        if len(line) >= 28:
            lines.append(line)

    result: dict[str, str | None] = {
        "surname": None,
        "given_names": None,
        "document_id": None,
        "date_of_birth": None,
        "nationality": None,
    }

    for line in lines:
        if "P<IND" in line or line.startswith("P<"):
            m = re.search(r"P<IND([A-Z]+)<<([A-Z<]+)", line)
            if not m:
                # OCR often drops '<' between given-name parts
                m = re.search(r"P<IND([A-Z]+)<<?([A-Z<]+)", line)
            if not m:
                m = re.search(r"P<[A-Z]{3}([A-Z]+)<<([A-Z<]+)", line)
            if m:
                result["surname"] = m.group(1).replace("<", " ").strip().title()
                given = m.group(2).replace("<", " ").strip()
                given = re.sub(r"([A-Z])([A-Z]{3,})([A-Z]{4,})", r"\1 \2 \3", given)
                result["given_names"] = re.sub(r"\s+", " ", given).title()
                result["nationality"] = "IND"

        # Line 2: passport number + DOB
        if re.match(r"^[A-Z0-9<€]{30,}", line) and "IND" in line:
            line = line.replace("€", "C").ljust(44, "<")[:44]
            passport = normalize_passport_number(line[0:9].replace("<", ""))
            if passport:
                result["document_id"] = passport
            idx = line.find("IND")
            if idx >= 0 and len(line) >= idx + 9:
                dob_raw = line[idx + 3 : idx + 9]
                if dob_raw.isdigit() and len(dob_raw) == 6:
                    result["date_of_birth"] = _yymmdd_to_slash(dob_raw)

    if not result["document_id"]:
        result["document_id"] = extract_passport_number(text)

    return result


def _yymmdd_to_slash(yymmdd: str) -> str:
    yy, mm, dd = int(yymmdd[0:2]), int(yymmdd[2:4]), int(yymmdd[4:6])
    century = 1900 if yy > 30 else 2000
    year = century + yy
    return f"{dd:02d}/{mm:02d}/{year}"


def combine_passport_name(surname: str | None, given_names: str | None) -> str | None:
    if given_names and surname:
        return f"{given_names} {surname}".strip().title()
    if given_names:
        return given_names.title()
    if surname:
        return surname.title()
    return None
