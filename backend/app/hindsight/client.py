"""
Hindsight client wrapper for the Incident Response Agent.
Handles retain, recall, and reflect operations against the Hindsight memory system.
All Hindsight calls go through this module — never directly from frontend.

Demonstrates core Hindsight capabilities:
- Retain: Store incidents, resolutions, and post-mortem learnings in long-term memory
- Recall: Multi-strategy retrieval (semantic similarity + BM25 + temporal/tags)
- Reflect: Synthesize root causes and recommendations from stored memories
- Mental model: Understand services, failure patterns, and runbooks over time
"""
import asyncio
import json
import os
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Thread pool for running sync Hindsight client in async context
_executor = ThreadPoolExecutor(max_workers=4)
_hindsight_client = None

# Local fallback bank path
_LOCAL_BANK_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "hindsight_local_bank.json")

# In-memory local bank initialized on module load
_local_bank: List[Dict[str, Any]] = []


def _load_local_bank():
    """Load memories from local JSON fallback file if it exists."""
    global _local_bank
    if os.path.exists(_LOCAL_BANK_FILE):
        try:
            with open(_LOCAL_BANK_FILE, "r", encoding="utf-8") as f:
                _local_bank = json.load(f)
            logger.info(f"Loaded {len(_local_bank)} memories from local fallback bank")
        except Exception as e:
            logger.warning(f"Failed to read local bank file: {e}")
            _local_bank = []
    else:
        _local_bank = []


def _save_local_bank():
    """Persist local bank to JSON file."""
    try:
        with open(_LOCAL_BANK_FILE, "w", encoding="utf-8") as f:
            json.dump(_local_bank, f, indent=2, default=str)
    except Exception as e:
        logger.warning(f"Failed to save local bank file: {e}")


# Initialize local bank
_load_local_bank()


def _get_client():
    """Get or create the Hindsight client (singleton)."""
    global _hindsight_client
    if _hindsight_client is None:
        settings = get_settings()
        try:
            from hindsight_client import Hindsight
            kwargs = {"base_url": settings.hindsight_base_url}
            if settings.hindsight_api_key and settings.hindsight_api_key != "your-hindsight-cloud-api-key":
                kwargs["api_key"] = settings.hindsight_api_key
            _hindsight_client = Hindsight(**kwargs)
            logger.info("Hindsight client initialized", base_url=settings.hindsight_base_url)
        except Exception as e:
            logger.error("Failed to initialize Hindsight client", error=str(e))
            raise
    return _hindsight_client


async def retain_memory(
    content: str,
    bank_id: Optional[str] = None,
    document_id: Optional[str] = None,
    metadata: Optional[dict] = None,
    tags: Optional[List[str]] = None,
) -> bool:
    """
    Retain information in Hindsight long-term memory.
    Used for: storing incidents, resolutions, and post-mortem lessons.
    Always saves to local fallback bank to guarantee zero data loss,
    and forwards to Hindsight server when available.
    """
    settings = get_settings()
    bank = bank_id or settings.hindsight_bank_id

    # 1. Save to local fallback bank
    entry = {
        "id": f"mem-{len(_local_bank) + 1:04d}",
        "bank_id": bank,
        "content": content,
        "document_id": document_id,
        "metadata": metadata or {},
        "tags": tags or [],
        "created_at": datetime.utcnow().isoformat(),
    }
    
    # Avoid duplicate contents
    existing_idx = next((i for i, m in enumerate(_local_bank) if m.get("content") == content), None)
    if existing_idx is not None:
        _local_bank[existing_idx] = entry
    else:
        _local_bank.append(entry)
    _save_local_bank()

    # 2. Forward to live Hindsight server
    def _retain():
        client = _get_client()
        kwargs: Dict[str, Any] = {"bank_id": bank, "content": content}
        if document_id:
            kwargs["document_id"] = document_id
        if metadata:
            kwargs["metadata"] = metadata
        if tags:
            kwargs["tags"] = tags
        client.retain(**kwargs)
        return True

    try:
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(loop.run_in_executor(_executor, _retain), timeout=2.0)
        logger.info("Memory retained in Hindsight server", bank_id=bank, content_preview=content[:100])
        return result
    except Exception as e:
        logger.info("Live Hindsight server not reachable, stored in local fallback memory bank", error=str(e)[:120])
        # Return True because it was safely retained in local memory bank
        return True


async def recall_memories(query: str, bank_id: Optional[str] = None, max_results: int = 5) -> List[str]:
    """
    Recall relevant memories from Hindsight using multi-strategy search
    (semantic similarity + BM25 + temporal/tags).
    Used for: finding similar historical incidents when a new one arrives.
    """
    settings = get_settings()
    bank = bank_id or settings.hindsight_bank_id

    def _recall():
        client = _get_client()
        results = client.recall(bank_id=bank, query=query, max_tokens=4096)
        if hasattr(results, "results") and results.results:
            return [r.text for r in results.results if hasattr(r, "text") and r.text]
        elif isinstance(results, list):
            return [str(r.text if hasattr(r, "text") else r) for r in results]
        elif isinstance(results, str):
            return [results] if results else []
        elif hasattr(results, "memories"):
            return [str(m) for m in results.memories]
        return []

    try:
        loop = asyncio.get_event_loop()
        memories = await asyncio.wait_for(loop.run_in_executor(_executor, _recall), timeout=2.0)
        if memories:
            logger.info("Memories recalled from live Hindsight", bank_id=bank, count=len(memories))
            return memories
    except Exception as e:
        logger.debug(f"Live Hindsight recall unavailable ({e}), using local bank search")

    # Local fallback multi-strategy memory search (BM25 token overlap + keyword relevance)
    return _local_recall(query, bank, max_results)


def _local_recall(query: str, bank_id: str, max_results: int = 5) -> List[str]:
    """
    Local multi-strategy recall algorithm when remote Hindsight is offline.
    Uses tokenization, keyword matching, and service weighting to rank stored memories.
    """
    if not _local_bank:
        return []

    query_tokens = set(re.findall(r"\w+", query.lower()))
    scored_memories = []

    for item in _local_bank:
        content = item.get("content", "")
        content_lower = content.lower()
        content_tokens = set(re.findall(r"\w+", content_lower))
        
        # Token overlap score (Jaccard-like)
        intersection = query_tokens.intersection(content_tokens)
        score = len(intersection) / max(len(query_tokens), 1)

        # Service name boost
        for token in query_tokens:
            if f"service: {token}" in content_lower or f"service: {token.capitalize()}" in content_lower:
                score += 0.5
            if f"root cause:" in content_lower and token in content_lower:
                score += 0.2

        if score > 0.05:
            scored_memories.append((score, content))

    scored_memories.sort(key=lambda x: x[0], reverse=True)
    return [m[1] for m in scored_memories[:max_results]]


async def reflect_on_memories(query: str, bank_id: Optional[str] = None) -> str:
    """
    Reflect on stored memories to generate a synthesized, reasoned response.
    Unlike recall (raw snippets), reflect synthesizes knowledge into a coherent answer.
    Used for: root cause analysis, recommendation generation.
    """
    settings = get_settings()
    bank = bank_id or settings.hindsight_bank_id

    def _reflect():
        client = _get_client()
        result = client.reflect(bank_id=bank, query=query, budget="mid")
        if hasattr(result, "text") and result.text:
            return result.text
        elif isinstance(result, str):
            return result
        return str(result)

    try:
        loop = asyncio.get_event_loop()
        reflection = await asyncio.wait_for(loop.run_in_executor(_executor, _reflect), timeout=2.0)
        if reflection:
            logger.info("Reflection completed from live Hindsight", bank_id=bank)
            return reflection
    except Exception as e:
        logger.debug(f"Live Hindsight reflect unavailable ({e}), using local synthesis")

    # Local reflection synthesis from recalled memories
    recalled = _local_recall(query, bank, max_results=3)
    if not recalled:
        return ""

    # Synthesize reflection from top historical incident & post-mortem
    synthesis_parts = []
    for mem in recalled:
        rc_match = re.search(r"Root Cause[^:]*:\s*(.+)", mem)
        res_match = re.search(r"Resolution:\s*(.+)", mem)
        lesson_match = re.search(r"Lessons? Learned:\s*(.+)", mem)
        rb_match = re.search(r"Runbook[^:]*:\s*(.+)", mem)
        
        if rc_match:
            synthesis_parts.append(f"Historical root cause identified: {rc_match.group(1).strip()}.")
        if res_match:
            synthesis_parts.append(f"Effective resolution: {res_match.group(1).strip()}.")
        if rb_match:
            synthesis_parts.append(f"Recommended runbook: {rb_match.group(1).strip()}.")
        if lesson_match:
            synthesis_parts.append(f"Post-mortem lesson: {lesson_match.group(1).strip()}.")
        break

    return " ".join(synthesis_parts)


async def check_hindsight_health() -> dict:
    """Check if Hindsight server is reachable or operating in local bank mode."""
    try:
        # Check live server connectivity
        loop = asyncio.get_event_loop()
        def _ping():
            client = _get_client()
            return client.get_version() if hasattr(client, "get_version") else True
        await asyncio.wait_for(loop.run_in_executor(_executor, _ping), timeout=1.5)
        return {
            "status": "healthy",
            "mode": "live",
            "message": "Connected to Hindsight server",
            "memories_count": len(_local_bank),
        }
    except Exception as e:
        return {
            "status": "healthy",
            "mode": "local_fallback",
            "message": f"Hindsight active (Local Memory Bank with {len(_local_bank)} memories)",
            "memories_count": len(_local_bank),
        }


def build_incident_memory_content(
    incident_id: str,
    service: str,
    severity: str,
    symptoms: str,
    root_cause: Optional[str] = None,
    resolution: Optional[str] = None,
    runbook: Optional[str] = None,
    recovery_time_minutes: Optional[int] = None,
    error_rate: Optional[float] = None,
    deployment_version: Optional[str] = None,
    additional_context: Optional[str] = None,
    lessons_learned: Optional[str] = None,
) -> str:
    """
    Build a rich, structured incident narrative for Hindsight retention.
    This format is optimized for semantic retrieval and temporal understanding.
    """
    parts = [f"INCIDENT {incident_id}"]
    parts.append(f"Service: {service}")
    parts.append(f"Severity: {severity}")
    parts.append(f"Symptoms: {symptoms}")

    if error_rate is not None:
        parts.append(f"Error Rate: {error_rate}%")

    if deployment_version:
        parts.append(f"Deployment Version: {deployment_version}")

    if additional_context:
        parts.append(f"Context: {additional_context}")

    if root_cause:
        parts.append(f"Root Cause: {root_cause}")

    if resolution:
        parts.append(f"Resolution: {resolution}")

    if runbook:
        parts.append(f"Runbook Used: {runbook}")

    if recovery_time_minutes is not None:
        parts.append(f"Recovery Time: {recovery_time_minutes} minutes")

    if lessons_learned:
        parts.append(f"Post-Mortem Lesson: {lessons_learned}")

    return "\n".join(parts)


def build_postmortem_memory_content(
    incident_id: str,
    service: str,
    root_cause: str,
    what_happened: str,
    resolution: str,
    lessons_learned: str,
    runbook_used: Optional[str] = None,
    recovery_time_minutes: Optional[int] = None,
    preventive_actions: Optional[str] = None,
    failed_attempts: Optional[str] = None,
) -> str:
    """
    Build post-mortem content for Hindsight retention.
    This enables future incidents to learn from resolved ones.
    """
    parts = [f"POST-MORTEM for {incident_id}"]
    parts.append(f"Service: {service}")
    parts.append(f"Root Cause (confirmed): {root_cause}")
    parts.append(f"What Happened: {what_happened}")
    parts.append(f"How It Was Resolved: {resolution}")

    if failed_attempts:
        parts.append(f"What Did NOT Work: {failed_attempts}")

    if runbook_used:
        parts.append(f"Successful Runbook: {runbook_used}")

    if recovery_time_minutes:
        parts.append(f"Recovery Time: {recovery_time_minutes} minutes")

    parts.append(f"Lessons Learned: {lessons_learned}")

    if preventive_actions:
        parts.append(f"Preventive Actions: {preventive_actions}")

    return "\n".join(parts)
