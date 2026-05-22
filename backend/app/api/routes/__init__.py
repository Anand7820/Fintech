from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.identity import router as identity_router
from app.api.routes.metrics import router as metrics_router
from app.api.routes.verify import router as verify_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["Health"])
api_router.include_router(verify_router, tags=["Verification"])
api_router.include_router(identity_router, tags=["Identity"])
api_router.include_router(metrics_router, tags=["Metrics"])
