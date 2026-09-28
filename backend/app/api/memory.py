"""
Memory API — Hindsight memory management endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.hindsight.client import recall_memories, retain_memory, reflect_on_memories
from app.models.database import Incident, PostMortem, get_db
from app.schemas.incidents import MemorySearchRequest, MemorySearchResult, MemoryStats
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/memory", tags=["memory"])


@router.post("/search", response_model=MemorySearchResult)
async def search_memory(data: MemorySearchRequest):
    """Search Hindsight memory for relevant information."""
    try:
        memories = await recall_memories(data.query)
        return MemorySearchResult(
            memories=memories,
            total_count=len(memories),
            query=data.query,
        )
    except Exception as e:
        logger.error("Memory search failed", error=str(e))
        raise HTTPException(status_code=503, detail="Hindsight memory service unavailable")


@router.get("/stats", response_model=MemoryStats)
async def get_memory_stats(db: AsyncSession = Depends(get_db)):
    """Get memory statistics including total retained incidents."""
    from app.core.config import get_settings
    settings = get_settings()
    
    # Get recent incidents retained in Hindsight
    recent_retained = await db.execute(
        select(Incident)
        .where(Incident.retained_in_hindsight == True)
        .order_by(Incident.detected_at.desc())
        .limit(5)
    )
    recent = recent_retained.scalars().all()
    
    # Count total memories
    total_retained = await db.execute(
        select(func.count(Incident.id)).where(Incident.retained_in_hindsight == True)
    )
    postmortem_count = await db.execute(
        select(func.count(PostMortem.id)).where(PostMortem.saved_to_hindsight == True)
    )
    
    total_count = (total_retained.scalar() or 0) + (postmortem_count.scalar() or 0)
    
    # Check Hindsight health
    try:
        test_memories = await recall_memories("system health check")
        hindsight_status = "healthy"
    except Exception:
        hindsight_status = "unavailable"
    
    recent_learns = []
    for inc in recent:
        recent_learns.append({
            "incident_id": inc.incident_id,
            "service": inc.service,
            "severity": inc.severity,
            "root_cause": inc.root_cause[:80] if inc.root_cause else None,
            "runbook": inc.recommended_runbook,
            "retained_at": inc.updated_at.isoformat() if inc.updated_at else None,
        })
    
    return MemoryStats(
        total_memories=total_count,
        bank_id=settings.hindsight_bank_id,
        hindsight_status=hindsight_status,
        recent_learns=recent_learns,
    )


@router.post("/retain")
async def manually_retain_memory(content: dict):
    """Manually retain information in Hindsight memory (for demo seeding)."""
    if "content" not in content:
        raise HTTPException(status_code=400, detail="content field required")
    
    success = await retain_memory(content["content"])
    if not success:
        raise HTTPException(status_code=503, detail="Failed to retain memory in Hindsight")
    
    return {"message": "Memory retained successfully"}


@router.post("/reflect")
async def reflect_on_query(data: MemorySearchRequest):
    """Reflect on Hindsight memories for a given query."""
    try:
        reflection = await reflect_on_memories(data.query)
        return {"query": data.query, "reflection": reflection}
    except Exception as e:
        logger.error("Memory reflection failed", error=str(e))
        raise HTTPException(status_code=503, detail="Hindsight reflection service unavailable")
