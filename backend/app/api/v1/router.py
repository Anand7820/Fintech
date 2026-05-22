from fastapi import APIRouter

from app.api.v1 import health, identity, metrics, verify

api_router = APIRouter()
api_router.include_router(verify.router)
api_router.include_router(identity.router)
api_router.include_router(metrics.router)
api_router.include_router(health.router)
