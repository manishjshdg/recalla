"""
In-memory conversation session store.

Each session holds:
- conversation_id
- full message history (user + assistant turns)
- extracted incident context (service, symptoms, severity, etc.)
- retrieved Hindsight evidence for this session
- timestamps

Sessions expire after TTL (default 1 hour).
Thread-safe via asyncio locks.
"""
import asyncio
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class Message:
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class IncidentContext:
    """Extracted incident information built up over conversation turns."""
    service: Optional[str] = None
    severity: Optional[str] = None
    symptoms: Optional[str] = None
    error_message: Optional[str] = None
    affected_component: Optional[str] = None
    deployment_version: Optional[str] = None
    error_rate: Optional[float] = None
    environment: Optional[str] = None
    timeline: Optional[str] = None   # e.g. "started 10 minutes ago"
    recent_changes: Optional[str] = None
    additional_context: Optional[str] = None

    def is_actionable(self) -> bool:
        """True if we have enough info to search Hindsight and give useful advice."""
        return bool(self.service and self.symptoms)

    def summary(self) -> str:
        parts = []
        if self.service:
            parts.append(f"Service: {self.service}")
        if self.severity:
            parts.append(f"Severity: {self.severity}")
        if self.symptoms:
            parts.append(f"Symptoms: {self.symptoms}")
        if self.error_message:
            parts.append(f"Error: {self.error_message}")
        if self.affected_component:
            parts.append(f"Component: {self.affected_component}")
        if self.deployment_version:
            parts.append(f"Deployment: {self.deployment_version}")
        if self.error_rate is not None:
            parts.append(f"Error rate: {self.error_rate}%")
        if self.timeline:
            parts.append(f"Timeline: {self.timeline}")
        if self.recent_changes:
            parts.append(f"Recent changes: {self.recent_changes}")
        if self.additional_context:
            parts.append(f"Context: {self.additional_context}")
        return "\n".join(parts) if parts else "No structured context yet"


@dataclass
class ConversationSession:
    conversation_id: str
    incident_id: Optional[str]           # linked DB incident if user picks one
    messages: List[Message] = field(default_factory=list)
    incident_context: IncidentContext = field(default_factory=IncidentContext)
    retrieved_memories: List[str] = field(default_factory=list)
    memory_search_done: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_active: datetime = field(default_factory=datetime.utcnow)

    def add_message(self, role: str, content: str):
        self.messages.append(Message(role=role, content=content))
        self.last_active = datetime.utcnow()

    def history_for_llm(self) -> List[Dict[str, str]]:
        """Return messages in the format expected by LLM APIs."""
        return [{"role": m.role, "content": m.content} for m in self.messages]

    def is_expired(self, ttl_seconds: int) -> bool:
        return datetime.utcnow() > self.last_active + timedelta(seconds=ttl_seconds)


class ConversationStore:
    """Thread-safe in-memory conversation session store."""

    def __init__(self):
        self._sessions: Dict[str, ConversationSession] = {}
        self._lock = asyncio.Lock()

    async def create(self, incident_id: Optional[str] = None) -> ConversationSession:
        conversation_id = str(uuid.uuid4())
        session = ConversationSession(
            conversation_id=conversation_id,
            incident_id=incident_id,
        )
        async with self._lock:
            self._sessions[conversation_id] = session
        logger.info("Conversation session created", conversation_id=conversation_id)
        return session

    async def get(self, conversation_id: str) -> Optional[ConversationSession]:
        settings = get_settings()
        async with self._lock:
            session = self._sessions.get(conversation_id)
            if session and session.is_expired(settings.conversation_ttl_seconds):
                del self._sessions[conversation_id]
                logger.info("Conversation session expired", conversation_id=conversation_id)
                return None
            if session:
                session.last_active = datetime.utcnow()
            return session

    async def get_or_create(
        self,
        conversation_id: Optional[str],
        incident_id: Optional[str] = None,
    ) -> ConversationSession:
        if conversation_id:
            session = await self.get(conversation_id)
            if session:
                return session
        return await self.create(incident_id)

    async def delete(self, conversation_id: str):
        async with self._lock:
            self._sessions.pop(conversation_id, None)

    async def cleanup_expired(self):
        settings = get_settings()
        async with self._lock:
            expired = [
                cid for cid, s in self._sessions.items()
                if s.is_expired(settings.conversation_ttl_seconds)
            ]
            for cid in expired:
                del self._sessions[cid]
            if expired:
                logger.info("Cleaned up expired sessions", count=len(expired))

    def active_count(self) -> int:
        return len(self._sessions)


# Singleton store — shared across all requests
conversation_store = ConversationStore()
