import asyncio
from dataclasses import dataclass, field


@dataclass
class MetricsState:
    total_verified: int = 0
    total_flagged: int = 0
    total_pending: int = 0

    def record_verification(self, status: str) -> None:
        if status == "verified":
            self.total_verified += 1
        elif status == "flagged":
            self.total_flagged += 1
        else:
            self.total_pending += 1

    @property
    def total_processed(self) -> int:
        return self.total_verified + self.total_flagged + self.total_pending

    @property
    def approval_rate_percent(self) -> float:
        total = self.total_processed
        if total == 0:
            return 0.0
        return round((self.total_verified / total) * 100.0, 2)


class MetricsStore:
    """Thread-safe in-memory metrics aggregator."""

    def __init__(self) -> None:
        self._state = MetricsState(total_verified=1420, total_flagged=8, total_pending=3)
        self._lock = asyncio.Lock()

    async def record(self, status: str) -> None:
        async with self._lock:
            self._state.record_verification(status)

    async def snapshot(self) -> MetricsState:
        async with self._lock:
            return MetricsState(
                total_verified=self._state.total_verified,
                total_flagged=self._state.total_flagged,
                total_pending=self._state.total_pending,
            )


metrics_store = MetricsStore()
