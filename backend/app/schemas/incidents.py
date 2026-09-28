"""
Pydantic schemas for request/response validation.
"""
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


# --- Incident Schemas ---

class IncidentCreate(BaseModel):
    service: str = Field(..., min_length=1, max_length=100, description="Affected service name")
    severity: str = Field(..., description="Incident severity (SEV-1, Critical, etc.)")
    symptoms: str = Field(..., min_length=10, description="Observed symptoms")
    error_message: Optional[str] = Field(None, description="Exact error message if available")
    affected_component: Optional[str] = Field(None, description="Specific component affected")
    deployment_version: Optional[str] = Field(None, description="Recent deployment version")
    error_rate: Optional[float] = Field(None, ge=0, le=100, description="Error rate percentage")
    additional_context: Optional[str] = Field(None, description="Additional context")
    assigned_to: Optional[str] = Field(None, description="Assigned engineer/team")


class TimelineEvent(BaseModel):
    id: int
    timestamp: datetime
    event: str
    details: Optional[str]
    event_type: str

    class Config:
        from_attributes = True


class SimilarIncident(BaseModel):
    incident_id: str
    service: str
    severity: str
    symptoms: str
    root_cause: Optional[str]
    resolution: Optional[str]
    runbook: Optional[str]
    recovery_time_minutes: Optional[int]
    similarity_score: float
    relevance_label: str  # "94% relevant"
    detected_at: Optional[str]


class AnalysisResult(BaseModel):
    likely_root_cause: str
    confidence: str  # "High", "Medium", "Low"
    confidence_score: float  # 0.0 - 1.0
    similar_incidents: List[SimilarIncident]
    recommended_actions: List[str]
    recommended_runbook: Optional[str]
    why_this_recommendation: str
    historical_evidence: str
    risk_warnings: List[str]
    estimated_recovery_time: Optional[str]
    # Clearly separate retrieved evidence from AI reasoning
    retrieved_memories_raw: List[str]  # Raw Hindsight recall results
    ai_generated_reasoning: str  # AI synthesis on top of memories
    memory_count_used: int


class IncidentResponse(BaseModel):
    id: int
    incident_id: str
    service: str
    severity: str
    status: str
    symptoms: str
    error_message: Optional[str]
    affected_component: Optional[str]
    deployment_version: Optional[str]
    error_rate: Optional[float]
    additional_context: Optional[str]
    assigned_to: Optional[str]
    root_cause: Optional[str]
    confidence: Optional[str]
    recommended_actions: Optional[List[str]]
    recommended_runbook: Optional[str]
    similar_incidents: Optional[List[Any]]
    evidence: Optional[str]
    ai_reasoning: Optional[str]
    hindsight_recalled: bool
    resolution_notes: Optional[str]
    recovery_time_minutes: Optional[int]
    resolved_at: Optional[datetime]
    retained_in_hindsight: bool
    detected_at: datetime
    updated_at: datetime
    timeline: List[TimelineEvent] = []

    class Config:
        from_attributes = True


class IncidentListItem(BaseModel):
    id: int
    incident_id: str
    service: str
    severity: str
    status: str
    symptoms: str
    root_cause: Optional[str]
    confidence: Optional[str]
    recommended_runbook: Optional[str]
    recovery_time_minutes: Optional[int]
    retained_in_hindsight: bool
    hindsight_recalled: bool
    detected_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class IncidentResolve(BaseModel):
    resolution_notes: str = Field(..., min_length=10, description="How the incident was resolved")
    recovery_time_minutes: int = Field(..., gt=0, description="Time to recover in minutes")


class PostMortemCreate(BaseModel):
    incident_summary: str = Field(..., min_length=20)
    root_cause: str = Field(..., min_length=10)
    what_happened: str = Field(..., min_length=20)
    resolution: str = Field(..., min_length=10)
    failed_attempts: Optional[str] = None
    runbook_used: Optional[str] = None
    recovery_time_minutes: Optional[int] = Field(None, gt=0)
    lessons_learned: str = Field(..., min_length=20)
    preventive_actions: Optional[str] = None


class PostMortemResponse(BaseModel):
    id: int
    incident_id: int
    incident_summary: str
    root_cause: str
    what_happened: str
    resolution: str
    failed_attempts: Optional[str]
    runbook_used: Optional[str]
    recovery_time_minutes: Optional[int]
    lessons_learned: str
    preventive_actions: Optional[str]
    saved_to_hindsight: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Memory Schemas ---

class MemorySearchRequest(BaseModel):
    query: str = Field(..., min_length=3)


class MemorySearchResult(BaseModel):
    memories: List[str]
    total_count: int
    query: str


class MemoryStats(BaseModel):
    total_memories: int
    bank_id: str
    hindsight_status: str
    recent_learns: List[dict]


# --- Runbook Schemas ---

class RunbookResponse(BaseModel):
    id: int
    name: str
    service: str
    purpose: str
    steps: List[str]
    warnings: Optional[List[str]]
    success_count: int
    total_uses: int
    success_rate: float
    created_at: datetime

    class Config:
        from_attributes = True


# --- Health Check ---

class HealthStatus(BaseModel):
    api: str
    database: str
    hindsight: str
    llm: str
    overall: str


# --- Conversational Chat Schemas ---

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = Field(
        None,
        description="Existing conversation ID. Omit or set null to start a new conversation."
    )
    incident_id: Optional[str] = Field(
        None,
        description="Optional: link conversation to an existing DB incident."
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User's natural-language message."
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Production is returning 500 errors after the latest deployment.",
                "conversation_id": None,
            }
        }


class IncidentContextSummary(BaseModel):
    service: Optional[str]
    severity: Optional[str]
    symptoms: Optional[str]
    timeline: Optional[str]
    deployment_version: Optional[str]


class ChatResponse(BaseModel):
    conversation_id: str
    agent_message: str
    turn_count: int
    incident_context: IncidentContextSummary
    hindsight_searched: bool
    memory_count: int
    memories_used: List[str]    # First 3 retrieved memories (provenance)
    status: str                 # "ok" | "llm_unavailable" | "degraded"
    error: Optional[str] = None

