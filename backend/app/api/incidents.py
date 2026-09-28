"""
Incidents API router — the core CRUD + analysis endpoints.
"""
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.models.database import Incident, IncidentTimeline, PostMortem, Runbook, get_db
from app.schemas.incidents import (
    IncidentCreate, IncidentResponse, IncidentListItem,
    IncidentResolve, PostMortemCreate, PostMortemResponse, AnalysisResult
)
from app.agents.incident_agent import analyze_incident
from app.hindsight.client import (
    retain_memory, recall_memories,
    build_incident_memory_content, build_postmortem_memory_content
)
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _generate_incident_id() -> str:
    """Generate a unique incident ID in INC-YYYY-NNN format."""
    year = datetime.utcnow().year
    uid = str(uuid.uuid4())[:6].upper()
    return f"INC-{year}-{uid}"


async def _add_timeline_event(db: AsyncSession, incident_id: int, event: str, details: str = None, event_type: str = "info"):
    """Add a timeline event to an incident."""
    timeline = IncidentTimeline(
        incident_id=incident_id,
        event=event,
        details=details,
        event_type=event_type,
    )
    db.add(timeline)
    await db.flush()


@router.post("", response_model=IncidentResponse, status_code=201)
async def create_incident(
    data: IncidentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new incident and retain it in Hindsight memory.
    The incident is immediately stored in the DB and added to Hindsight.
    """
    incident_id = _generate_incident_id()
    
    incident = Incident(
        incident_id=incident_id,
        service=data.service,
        severity=data.severity,
        status="detected",
        symptoms=data.symptoms,
        error_message=data.error_message,
        affected_component=data.affected_component,
        deployment_version=data.deployment_version,
        error_rate=data.error_rate,
        additional_context=data.additional_context,
        assigned_to=data.assigned_to,
    )
    db.add(incident)
    await db.flush()

    # Add timeline event
    await _add_timeline_event(db, incident.id, "Incident detected", data.symptoms, "critical")
    
    await db.commit()
    await db.refresh(incident)

    # Retain in Hindsight (background — don't block response)
    background_tasks.add_task(
        _retain_incident_in_hindsight,
        incident_id=incident_id,
        service=data.service,
        severity=data.severity,
        symptoms=data.symptoms,
        error_message=data.error_message,
        deployment_version=data.deployment_version,
        error_rate=data.error_rate,
        additional_context=data.additional_context,
        db_incident_id=incident.id,
    )

    logger.info("Incident created", incident_id=incident_id, service=data.service)
    return incident


async def _retain_incident_in_hindsight(
    incident_id: str, service: str, severity: str, symptoms: str,
    error_message: Optional[str], deployment_version: Optional[str],
    error_rate: Optional[float], additional_context: Optional[str],
    db_incident_id: int,
):
    """Background task: retain incident in Hindsight memory."""
    content = build_incident_memory_content(
        incident_id=incident_id, service=service, severity=severity,
        symptoms=symptoms, error_message=error_message,
        deployment_version=deployment_version, error_rate=error_rate,
        additional_context=additional_context,
    )
    success = await retain_memory(content)
    
    if success:
        # Update DB to mark as retained
        from app.models.database import get_session_factory
        session_factory = get_session_factory()
        async with session_factory() as session:
            result = await session.execute(select(Incident).where(Incident.id == db_incident_id))
            db_incident = result.scalar_one_or_none()
            if db_incident:
                db_incident.retained_in_hindsight = True
                await session.commit()
        logger.info("Incident retained in Hindsight", incident_id=incident_id)


@router.get("", response_model=List[IncidentListItem])
async def list_incidents(
    service: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List all incidents with optional filters."""
    query = select(Incident).order_by(desc(Incident.detected_at)).limit(limit)
    
    if service:
        query = query.where(Incident.service.ilike(f"%{service}%"))
    if severity:
        query = query.where(Incident.severity == severity)
    if status:
        query = query.where(Incident.status == status)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific incident with full details and timeline."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.timeline))
        .where(Incident.incident_id == incident_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")
    return incident


@router.post("/{incident_id}/analyze", response_model=AnalysisResult)
async def analyze_incident_route(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger AI investigation for an incident.
    Uses Hindsight recall + reflect to find similar incidents and recommend resolution.
    """
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Incident).where(Incident.incident_id == incident_id)
    )
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    # Update status to investigating
    incident.status = "investigating"
    await _add_timeline_event(db, incident.id, "AI investigation started", "Querying Hindsight memory for similar incidents", "ai")
    await db.commit()

    try:
        # Run the AI analysis (Hindsight recall + reflect + LLM)
        analysis = await analyze_incident(
            service=incident.service,
            severity=incident.severity,
            symptoms=incident.symptoms,
            error_message=incident.error_message,
            affected_component=incident.affected_component,
            deployment_version=incident.deployment_version,
            error_rate=incident.error_rate,
            additional_context=incident.additional_context,
        )

        # Store analysis results in DB
        incident.root_cause = analysis.likely_root_cause
        incident.confidence = analysis.confidence
        incident.recommended_actions = analysis.recommended_actions
        incident.recommended_runbook = analysis.recommended_runbook
        incident.evidence = analysis.historical_evidence
        incident.ai_reasoning = analysis.ai_generated_reasoning
        incident.hindsight_recalled = analysis.memory_count_used > 0
        incident.similar_incidents = [si.dict() for si in analysis.similar_incidents]

        # Add timeline events
        memory_count = analysis.memory_count_used
        await _add_timeline_event(
            db, incident.id,
            f"Hindsight recalled {memory_count} relevant memories",
            f"Found {len(analysis.similar_incidents)} similar incidents",
            "memory"
        )
        await _add_timeline_event(
            db, incident.id,
            f"Root cause identified: {analysis.likely_root_cause[:80]}",
            f"Confidence: {analysis.confidence}",
            "ai"
        )
        if analysis.recommended_runbook:
            await _add_timeline_event(
                db, incident.id,
                f"Runbook recommended: {analysis.recommended_runbook}",
                None, "info"
            )

        await db.commit()
        logger.info("Incident analyzed", incident_id=incident_id, confidence=analysis.confidence)
        return analysis

    except Exception as e:
        logger.error("Analysis failed", incident_id=incident_id, error=str(e))
        await _add_timeline_event(db, incident.id, "Analysis failed", str(e), "error")
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/{incident_id}/similar")
async def get_similar_incidents(incident_id: str, db: AsyncSession = Depends(get_db)):
    """Get similar historical incidents from Hindsight for a given incident."""
    result = await db.execute(select(Incident).where(Incident.incident_id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    query = f"Service: {incident.service}\nSeverity: {incident.severity}\nSymptoms: {incident.symptoms}"
    memories = await recall_memories(query)
    
    return {
        "incident_id": incident_id,
        "similar_count": len(memories),
        "memories": memories[:5],
    }


@router.post("/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    data: IncidentResolve,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Mark incident as resolved and retain resolution details in Hindsight."""
    result = await db.execute(select(Incident).where(Incident.incident_id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident.status = "resolved"
    incident.resolution_notes = data.resolution_notes
    incident.recovery_time_minutes = data.recovery_time_minutes
    incident.resolved_at = datetime.utcnow()

    await _add_timeline_event(
        db, incident.id, "Incident resolved",
        f"Recovery time: {data.recovery_time_minutes} minutes", "success"
    )
    await db.commit()

    # Retain resolution in Hindsight (background)
    background_tasks.add_task(
        _retain_resolution_in_hindsight,
        incident=incident,
        resolution_notes=data.resolution_notes,
        recovery_time_minutes=data.recovery_time_minutes,
    )

    return {"message": "Incident resolved", "incident_id": incident_id}


async def _retain_resolution_in_hindsight(incident: Incident, resolution_notes: str, recovery_time_minutes: int):
    """Retain the resolution details in Hindsight memory."""
    content = build_incident_memory_content(
        incident_id=incident.incident_id,
        service=incident.service,
        severity=incident.severity,
        symptoms=incident.symptoms,
        root_cause=incident.root_cause,
        resolution=resolution_notes,
        runbook=incident.recommended_runbook,
        recovery_time_minutes=recovery_time_minutes,
        deployment_version=incident.deployment_version,
    )
    await retain_memory(content)
    logger.info("Resolution retained in Hindsight", incident_id=incident.incident_id)


@router.post("/{incident_id}/postmortem", response_model=PostMortemResponse)
async def create_postmortem(
    incident_id: str,
    data: PostMortemCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a post-mortem for an incident.
    Lessons learned are retained in Hindsight so future incidents benefit.
    """
    result = await db.execute(select(Incident).where(Incident.incident_id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Create post-mortem record
    postmortem = PostMortem(
        incident_id=incident.id,
        incident_summary=data.incident_summary,
        root_cause=data.root_cause,
        what_happened=data.what_happened,
        resolution=data.resolution,
        failed_attempts=data.failed_attempts,
        runbook_used=data.runbook_used,
        recovery_time_minutes=data.recovery_time_minutes,
        lessons_learned=data.lessons_learned,
        preventive_actions=data.preventive_actions,
    )
    db.add(postmortem)
    incident.status = "post_mortem"
    
    await _add_timeline_event(db, incident.id, "Post-mortem created", "Lessons being saved to Hindsight memory", "memory")
    await db.commit()
    await db.refresh(postmortem)

    # Retain post-mortem in Hindsight (background — this is the LEARNING step)
    background_tasks.add_task(
        _retain_postmortem_in_hindsight,
        postmortem=postmortem,
        incident=incident,
    )

    return postmortem


async def _retain_postmortem_in_hindsight(postmortem: PostMortem, incident: Incident):
    """
    The LEARN step: retain post-mortem lessons in Hindsight.
    This is what makes the agent better over time.
    """
    content = build_postmortem_memory_content(
        incident_id=incident.incident_id,
        service=incident.service,
        root_cause=postmortem.root_cause,
        what_happened=postmortem.what_happened,
        resolution=postmortem.resolution,
        lessons_learned=postmortem.lessons_learned,
        runbook_used=postmortem.runbook_used,
        recovery_time_minutes=postmortem.recovery_time_minutes,
        preventive_actions=postmortem.preventive_actions,
        failed_attempts=postmortem.failed_attempts,
    )
    success = await retain_memory(content)
    
    if success:
        from app.models.database import get_session_factory
        session_factory = get_session_factory()
        async with session_factory() as session:
            result = await session.execute(select(PostMortem).where(PostMortem.id == postmortem.id))
            pm = result.scalar_one_or_none()
            if pm:
                pm.saved_to_hindsight = True
                await session.commit()
        logger.info("Post-mortem lessons retained in Hindsight", incident_id=incident.incident_id)


@router.get("/{incident_id}/postmortem", response_model=PostMortemResponse)
async def get_postmortem(incident_id: str, db: AsyncSession = Depends(get_db)):
    """Get the post-mortem for an incident."""
    result = await db.execute(select(Incident).where(Incident.incident_id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    pm_result = await db.execute(select(PostMortem).where(PostMortem.incident_id == incident.id))
    postmortem = pm_result.scalar_one_or_none()
    if not postmortem:
        raise HTTPException(status_code=404, detail="No post-mortem found for this incident")
    
    return postmortem


@router.patch("/{incident_id}/status")
async def update_incident_status(
    incident_id: str,
    status: str,
    details: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Update incident status and optionally assign to engineer."""
    valid_statuses = ["detected", "acknowledged", "investigating", "mitigating", "resolved", "post_mortem"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.execute(select(Incident).where(Incident.incident_id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    old_status = incident.status
    incident.status = status
    if assigned_to:
        incident.assigned_to = assigned_to
    
    await _add_timeline_event(
        db, incident.id,
        f"Status changed: {old_status} → {status}",
        details or (f"Assigned to {assigned_to}" if assigned_to else None),
        "info"
    )
    await db.commit()
    
    return {"message": "Status updated", "incident_id": incident_id, "status": status}
