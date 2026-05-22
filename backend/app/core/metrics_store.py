"""Thread-safe in-memory + JSON persistence for dashboard aggregates."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

from app.core.config import get_settings


class MetricsStore:
    def __init__(self, path: Path | None = None) -> None:
        self._path = path or get_settings().upload_temp_dir.parent / "metrics.json"
        self._lock = threading.Lock()
        self._data: dict[str, int] = {
            "total_verified": 0,
            "total_flagged": 0,
            "total_pending": 0,
        }
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._persist()
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
            self._data.update(
                {
                    "total_verified": int(raw.get("total_verified", 0)),
                    "total_flagged": int(raw.get("total_flagged", 0)),
                    "total_pending": int(raw.get("total_pending", 0)),
                }
            )
        except (json.JSONDecodeError, OSError):
            pass

    def _persist(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")

    def snapshot(self) -> dict[str, int]:
        with self._lock:
            return dict(self._data)

    def record_verification(self, *, flagged: bool, pending: bool = False) -> None:
        with self._lock:
            if pending:
                self._data["total_pending"] += 1
            elif flagged:
                self._data["total_flagged"] += 1
            else:
                self._data["total_verified"] += 1
            self._persist()

    def record_identity_check(self, *, matched: bool) -> None:
        with self._lock:
            if matched:
                self._data["total_verified"] += 1
            else:
                self._data["total_flagged"] += 1
            self._persist()


metrics_store = MetricsStore()
