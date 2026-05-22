from typing import Literal

from pydantic import BaseModel, Field


class PreprocessingSummary(BaseModel):
    grayscale_applied: bool
    noise_reduction_applied: bool
    deskew_angle_degrees: float
    output_width: int
    output_height: int


class ExtractedFields(BaseModel):
    name: str | None = None
    surname: str | None = None
    given_names: str | None = None
    date_of_birth: str | None = None
    document_id: str | None = None
    nationality: str | None = None


class OCRResult(BaseModel):
    fields: ExtractedFields
    ocr_confidence: float = Field(..., ge=0.0, le=100.0)
    raw_text_snippet: str = Field(..., max_length=2000)


class LayoutAnalysis(BaseModel):
    template_matched: str | None = None
    layout_match_score: float = Field(..., ge=0.0, le=1.0)
    structural_integrity: bool


class MetadataAnalysis(BaseModel):
    font_consistency_score: float = Field(..., ge=0.0, le=1.0)
    metadata_tampering_detected: bool
    details: str


class ELAAnalysis(BaseModel):
    ela_variance_score: float = Field(..., ge=0.0, le=1.0)
    resave_regions_detected: bool
    suspicious_region_ratio: float = Field(..., ge=0.0, le=1.0)


class DetectedRegion(BaseModel):
    """Auto-detected overlay region (percent of image: 0–100)."""

    field_key: str
    label: str
    x: float = Field(..., ge=0.0, le=100.0)
    y: float = Field(..., ge=0.0, le=100.0)
    width: float = Field(..., ge=0.0, le=100.0)
    height: float = Field(..., ge=0.0, le=100.0)
    confidence: float = Field(default=80.0, ge=0.0, le=100.0)


class ForgeryAnalysis(BaseModel):
    layout: LayoutAnalysis
    metadata: MetadataAnalysis
    ela: ELAAnalysis
    forgery_score: float = Field(..., ge=0.0, le=1.0)
    is_suspected_fake: bool


class VerifyDocumentResponse(BaseModel):
    verification_id: str
    status: Literal["verified", "flagged", "pending_review"]
    document_type: str = "unknown"
    aadhaar_checksum_valid: bool | None = None
    preprocessing: PreprocessingSummary
    ocr: OCRResult
    forgery: ForgeryAnalysis
    detected_regions: list[DetectedRegion] = Field(default_factory=list)
    processing_time_ms: float


class IdentityValidationRequest(BaseModel):
    document_id: str
    name: str | None = None
    date_of_birth: str | None = None


class FieldMatchDetail(BaseModel):
    field: str
    extracted_value: str | None
    registry_value: str | None
    match: bool
    confidence: float = Field(..., ge=0.0, le=100.0)


class IdentityValidationResponse(BaseModel):
    document_id: str
    identity_verified: bool
    registry_match_score: float = Field(..., ge=0.0, le=100.0)
    field_matches: list[FieldMatchDetail]
    message: str


class DashboardMetricsResponse(BaseModel):
    total_verified: int
    total_flagged: int
    total_pending: int
    total_processed: int
    approval_rate_percent: float = Field(..., ge=0.0, le=100.0)


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
