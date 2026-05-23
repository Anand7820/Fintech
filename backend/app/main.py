from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.api import api_router
from app.core.config import get_settings
from app.core.exceptions import KYCBaseError, to_http_exception


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    try:
        settings.upload_temp_dir.mkdir(parents=True, exist_ok=True)
        settings.templates_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        print(f"Warning: Could not create directories (read-only filesystem): {e}")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8080", "http://127.0.0.1:8080"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(KYCBaseError)
    async def kyc_error_handler(_request: Request, exc: KYCBaseError) -> JSONResponse:
        http_exc = to_http_exception(exc)
        return JSONResponse(status_code=http_exc.status_code, content=http_exc.detail)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={"error": "validation_error", "message": "Invalid request payload.", "details": exc.errors()},
        )

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
