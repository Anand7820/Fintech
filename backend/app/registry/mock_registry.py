from dataclasses import dataclass


@dataclass(frozen=True)
class RegistryRecord:
    document_id: str
    name: str
    date_of_birth: str
    nationality: str
    status: str


MOCK_IDENTITY_REGISTRY: dict[str, RegistryRecord] = {
    "P98421098": RegistryRecord(
        document_id="P98421098",
        name="Sarah Elizabeth Harrington",
        date_of_birth="14 OCT 1992",
        nationality="USA",
        status="active",
    ),
    "DL88210344": RegistryRecord(
        document_id="DL88210344",
        name="Marcus Aurelius",
        date_of_birth="26 APR 1980",
        nationality="USA",
        status="active",
    ),
    "99887766551": RegistryRecord(
        document_id="99887766551",
        name="Robert Johnson",
        date_of_birth="12 JAN 1985",
        nationality="USA",
        status="active",
    ),
    "P12345678": RegistryRecord(
        document_id="P12345678",
        name="Jane Doe",
        date_of_birth="01 JAN 1990",
        nationality="USA",
        status="active",
    ),
}


def lookup_identity(document_id: str) -> RegistryRecord | None:
    normalized = document_id.upper().replace(" ", "").replace("-", "")
    for key, record in MOCK_IDENTITY_REGISTRY.items():
        if key.upper().replace("-", "") == normalized:
            return record
    return MOCK_IDENTITY_REGISTRY.get(document_id.upper())
