from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "KYC Verification API"
    app_version: str = "1.0.0"
    api_prefix: str = "/api/v1"
    debug: bool = False

    max_upload_bytes: int = 10 * 1024 * 1024
    allowed_content_types: tuple[str, ...] = (
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
    )

    # Forgery thresholds (0.0–1.0; higher forgery_score = more suspicious)
    layout_match_threshold: float = 0.55
    ela_suspicion_threshold: float = 0.35
    forgery_alert_threshold: float = 0.50

    templates_dir: Path = Path(__file__).resolve().parents[1] / "assets" / "templates"
    upload_temp_dir: Path = Path(__file__).resolve().parents[2] / "tmp" / "uploads"

    # OCR
    tesseract_cmd: str | None = None
    ocr_lang: str = "eng"


@lru_cache
def get_settings() -> Settings:
    return Settings()
