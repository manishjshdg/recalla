"""
FastAPI application entry point.
Configures middleware, routers, CORS, and startup events.
"""
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.models.database import init_db
from app.api.incidents import router as incidents_router
from app.api.memory import router as memory_router
from app.api.agent import router as agent_router
from app.api.health import health_router, runbooks_router, analytics_router

# Setup logging first
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    settings = get_settings()
    logger.info("Starting RECALLA Incident Intelligence Platform", env=settings.app_env)

    # Validate critical configuration on startup
    if not settings.llm_is_configured:
        logger.warning(
            "LLM NOT CONFIGURED",
            provider=settings.llm_provider,
            hint=f"Set {settings.llm_provider.upper()}_API_KEY in backend/.env",
        )
    else:
        logger.info("LLM configured", provider=settings.llm_provider, model=settings.llm_model)

    if not settings.hindsight_is_configured:
        logger.warning(
            "Hindsight live server not configured — using local fallback memory bank",
            url=settings.hindsight_base_url,
        )

    # Initialize database
    await init_db()
    logger.info("Database initialized")

    yield

    logger.info("Shutting down RECALLA Incident Intelligence Platform")


settings = get_settings()

app = FastAPI(
    title="RECALLA API",
    description="Incident Intelligence Platform powered by Hindsight long-term memory",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow all origins so Expo physical-device clients can reach this server.
# In production, restrict to your actual frontend domain.
origins = settings.cors_origins_list
if "*" in origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,   # Must be False when allow_origins=["*"]
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ── Request ID + timing middleware ────────────────────────────────────────────
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    import structlog
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    response = await call_next(request)

    duration_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms}ms"

    logger.info(
        "Request completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration_ms,
    )
    return response


# ── Global error handler ─────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again."},
    )


# ── Register routers ──────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(incidents_router)
app.include_router(memory_router)
app.include_router(agent_router)         # NEW: /api/agent/chat
app.include_router(runbooks_router)
app.include_router(analytics_router)


@app.get("/")
async def root():
    settings = get_settings()
    return {
        "name": "RECALLA Incident Intelligence Platform",
        "tagline": "Remember incidents. Resolve faster.",
        "version": "2.0.0",
        "memory": "Hindsight by Vectorize",
        "ai": f"{settings.llm_provider}/{settings.llm_model}",
        "llm_ready": settings.llm_is_configured,
        "hindsight_configured": settings.hindsight_is_configured,
        "docs": "/docs",
        "chat_endpoint": "/api/agent/chat",
    }
