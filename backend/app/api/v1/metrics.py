from fastapi import APIRouter

from app.models.schemas import DashboardMetricsResponse
from app.services.metrics_store import metrics_store

router = APIRouter(tags=["metrics"])


@router.get(
    "/dashboard-metrics",
    response_model=DashboardMetricsResponse,
    summary="Aggregate verification dashboard statistics",
)
async def dashboard_metrics() -> DashboardMetricsResponse:
    return await metrics_store.get_dashboard_metrics()
