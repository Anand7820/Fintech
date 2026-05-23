import re
from app.services.ocr.pan import _valid_name

text = """
 INCOME TAX DEPARTMENT 8 © GOVT.OFINDIA |

Permanent Account Number Card

MAVPK5195B

ara / Name

ANAND HEMANT KAMBLE

feet ait ATH / Father's Name
VITTHAL

HEMANT
oon ah arérea/

Date of Birth   |   7
2409/2006 6

TNOOME TAXDEPARTMENT “8 © GC

_  MAVPKS1IS956

41a / Name —
ANAND HEMANT KAMBLE

fret Gt ATH / Father's Name       “
HEMANT VITTHAL KAMBLE              ce

art tr | )
Date of Birth =e
24/09/2006
"""

upper = text.upper()
father_matches = re.finditer(r"(?:^|\n).*?FATHE?R?[^\n]*NAME[^\n]*\n([\s\S]*?)(?=\n.*?(?:DATE|BIRTH|जन्म|PAN|INCOME|GOVT|\d{2}[/-]\d{2}[/-]\d{4}|$))", upper)
for fm in father_matches:
    print("MATCH:", repr(fm.group(1)))
    cand = re.sub(r"[\n\s]+", " ", fm.group(1)).strip()
    cand = re.sub(r"[^A-Z\s]", "", cand).strip()
    cand = " ".join(w for w in cand.split() if len(w) > 1)
    print("CAND:", repr(cand))
    if len(cand) > 5 and _valid_name(cand):
        print("VALID! ->", cand.title())
