from fastapi import APIRouter

from app.models.schemas import DashboardMetricsResponse
from app.core.metrics_store import metrics_store

router = APIRouter()


@router.get(
    "/dashboard-metrics",
    response_model=DashboardMetricsResponse,
    summary="Aggregate verification dashboard statistics",
)
async def dashboard_metrics() -> DashboardMetricsResponse:
    state = metrics_store.snapshot()
    total_processed = state.get("total_verified", 0) + state.get("total_flagged", 0) + state.get("total_pending", 0)
    approval_rate = (state.get("total_verified", 0) / total_processed * 100) if total_processed > 0 else 0.0

    return DashboardMetricsResponse(
        total_verified=state.get("total_verified", 0),
        total_flagged=state.get("total_flagged", 0),
        total_pending=state.get("total_pending", 0),
        total_processed=total_processed,
        approval_rate_percent=round(approval_rate, 2),
    )
