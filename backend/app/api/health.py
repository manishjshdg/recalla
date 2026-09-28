"""
Health check and runbooks API endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.models.database import Runbook, get_db
from app.schemas.incidents import HealthStatus, RunbookResponse
from app.hindsight.client import check_hindsight_health
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Health router
health_router = APIRouter(tags=["health"])

@health_router.get("/health", response_model=HealthStatus)
async def health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check — API, DB, Hindsight, LLM."""
    settings = get_settings()

    # Check database
    try:
        await db.execute(select(Runbook).limit(1))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # Check Hindsight
    hindsight_result = await check_hindsight_health()
    hindsight_status = hindsight_result.get("status", "unknown")
    hindsight_mode = hindsight_result.get("mode", "unknown")
    if hindsight_mode == "local_fallback":
        hindsight_status = f"local_fallback ({hindsight_result.get('memories_count', 0)} memories)"

    # Check LLM — truthful: only healthy if key is actually configured
    if settings.llm_is_configured:
        llm_status = f"configured ({settings.llm_provider}/{settings.llm_model})"
    else:
        llm_status = f"not_configured — set {settings.llm_provider.upper()}_API_KEY in .env"

    overall = "healthy" if db_status == "healthy" and settings.llm_is_configured else "degraded"

    return HealthStatus(
        api="healthy",
        database=db_status,
        hindsight=hindsight_status,
        llm=llm_status,
        overall=overall,
    )



# Runbooks router
runbooks_router = APIRouter(prefix="/api/runbooks", tags=["runbooks"])

@runbooks_router.get("", response_model=List[RunbookResponse])
async def list_runbooks(db: AsyncSession = Depends(get_db)):
    """List all runbooks."""
    result = await db.execute(select(Runbook).order_by(Runbook.name))
    runbooks = result.scalars().all()
    return [
        RunbookResponse(
            id=r.id,
            name=r.name,
            service=r.service,
            purpose=r.purpose,
            steps=r.steps,
            warnings=r.warnings,
            success_count=r.success_count,
            total_uses=r.total_uses,
            success_rate=r.success_rate,
            created_at=r.created_at,
        )
        for r in runbooks
    ]


@runbooks_router.get("/{name}", response_model=RunbookResponse)
async def get_runbook(name: str, db: AsyncSession = Depends(get_db)):
    """Get a specific runbook by name."""
    from fastapi import HTTPException
    result = await db.execute(select(Runbook).where(Runbook.name == name))
    runbook = result.scalar_one_or_none()
    if not runbook:
        raise HTTPException(status_code=404, detail=f"Runbook '{name}' not found")
    return RunbookResponse(
        id=runbook.id,
        name=runbook.name,
        service=runbook.service,
        purpose=runbook.purpose,
        steps=runbook.steps,
        warnings=runbook.warnings,
        success_count=runbook.success_count,
        total_uses=runbook.total_uses,
        success_rate=runbook.success_rate,
        created_at=runbook.created_at,
    )


# Analytics router
analytics_router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@analytics_router.get("")
async def get_analytics(db: AsyncSession = Depends(get_db)):
    """Get incident response analytics."""
    from sqlalchemy import func
    from app.models.database import Incident, PostMortem
    
    # Total incidents
    total_result = await db.execute(select(func.count(Incident.id)))
    total_incidents = total_result.scalar() or 0
    
    # Active incidents
    active_result = await db.execute(
        select(func.count(Incident.id)).where(
            Incident.status.in_(["detected", "acknowledged", "investigating", "mitigating"])
        )
    )
    active_incidents = active_result.scalar() or 0
    
    # Resolved incidents
    resolved_result = await db.execute(
        select(func.count(Incident.id)).where(Incident.status.in_(["resolved", "post_mortem"]))
    )
    resolved_incidents = resolved_result.scalar() or 0
    
    # Mean time to recovery (from incidents with recovery time)
    mttr_result = await db.execute(
        select(func.avg(Incident.recovery_time_minutes)).where(
            Incident.recovery_time_minutes.isnot(None)
        )
    )
    avg_recovery = mttr_result.scalar()
    mttr_minutes = round(avg_recovery, 1) if avg_recovery else None
    
    # Incidents with Hindsight recall used
    hindsight_used = await db.execute(
        select(func.count(Incident.id)).where(Incident.hindsight_recalled == True)
    )
    hindsight_count = hindsight_used.scalar() or 0
    
    # Post-mortems saved to Hindsight
    pm_count = await db.execute(
        select(func.count(PostMortem.id)).where(PostMortem.saved_to_hindsight == True)
    )
    pm_hindsight = pm_count.scalar() or 0
    
    # Most affected services
    service_result = await db.execute(
        select(Incident.service, func.count(Incident.id).label("count"))
        .group_by(Incident.service)
        .order_by(func.count(Incident.id).desc())
        .limit(5)
    )
    most_affected = [{"service": row[0], "count": row[1]} for row in service_result.fetchall()]
    
    # Severity breakdown
    severity_result = await db.execute(
        select(Incident.severity, func.count(Incident.id).label("count"))
        .group_by(Incident.severity)
        .order_by(func.count(Incident.id).desc())
    )
    severity_breakdown = [{"severity": row[0], "count": row[1]} for row in severity_result.fetchall()]
    
    return {
        "total_incidents": total_incidents,
        "active_incidents": active_incidents,
        "resolved_incidents": resolved_incidents,
        "mttr_minutes": mttr_minutes,
        "hindsight_recalls_used": hindsight_count,
        "postmortems_saved_to_hindsight": pm_hindsight,
        "most_affected_services": most_affected,
        "severity_breakdown": severity_breakdown,
    }
