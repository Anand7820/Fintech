from fastapi import APIRouter

from app.models.schemas import DashboardMetricsResponse
from app.services.metrics_store import metrics_store

router = APIRouter()


@router.get(
    "/dashboard-metrics",
    response_model=DashboardMetricsResponse,
    summary="Aggregate verification dashboard statistics",
)
async def dashboard_metrics() -> DashboardMetricsResponse:
    state = await metrics_store.snapshot()
    return DashboardMetricsResponse(
        total_verified=state.total_verified,
        total_flagged=state.total_flagged,
        total_pending=state.total_pending,
        total_processed=state.total_processed,
        approval_rate_percent=state.approval_rate_percent,
    )
