"""
Conversational AI Agent API — POST /api/agent/chat

This is the core endpoint that powers the mobile chat UI.
It maintains full conversation context across multiple turns.

Flow per request:
1. Validate input
2. Get or create conversation session
3. Pass message to AI agent (Gemini + Hindsight)
4. Return structured response with conversation_id for next turn
"""
import asyncio
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.schemas.incidents import ChatRequest, ChatResponse, IncidentContextSummary
from app.core.conversation import conversation_store
from app.core.logging import get_logger
from app.core.config import get_settings

logger = get_logger(__name__)
router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    background_tasks: BackgroundTasks,
) -> ChatResponse:
    """
    Send a message to the RECALLA incident-response agent.

    - Omit conversation_id (or set null) to start a NEW conversation.
    - Include the returned conversation_id in subsequent requests to continue.
    - The agent maintains full incident context across turns.
    - Hindsight is searched automatically once enough context is gathered.
    """
    settings = get_settings()

    # Validate LLM is configured before doing anything
    if not settings.llm_is_configured:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "llm_not_configured",
                "message": (
                    f"LLM provider '{settings.llm_provider}' is not configured. "
                    "Please set the API key in backend/.env and restart the server. "
                    f"For Gemini: set GEMINI_API_KEY=<your-key> and LLM_PROVIDER=gemini"
                ),
            },
        )

    # Get or create conversation session
    session = await conversation_store.get_or_create(
        conversation_id=data.conversation_id,
        incident_id=data.incident_id,
    )

    logger.info(
        "Chat message received",
        conversation_id=session.conversation_id,
        turn=len(session.messages) + 1,
        message_preview=data.message[:80],
    )

    try:
        # Import here to avoid circular at module level
        from app.agents.incident_agent import handle_chat_message

        result = await asyncio.wait_for(
            handle_chat_message(session, data.message),
            timeout=45.0,
        )

        # Background cleanup of expired sessions
        background_tasks.add_task(conversation_store.cleanup_expired)

        logger.info(
            "Chat response sent",
            conversation_id=session.conversation_id,
            turn_count=result["turn_count"],
            hindsight_searched=result["hindsight_searched"],
            memory_count=result["memory_count"],
        )

        ctx = result.get("incident_context", {})
        return ChatResponse(
            conversation_id=result["conversation_id"],
            agent_message=result["agent_message"],
            turn_count=result["turn_count"],
            incident_context=IncidentContextSummary(
                service=ctx.get("service"),
                severity=ctx.get("severity"),
                symptoms=ctx.get("symptoms"),
                timeline=ctx.get("timeline"),
                deployment_version=ctx.get("deployment_version"),
            ),
            hindsight_searched=result["hindsight_searched"],
            memory_count=result["memory_count"],
            memories_used=result["memories_used"],
            status="ok",
        )

    except asyncio.TimeoutError:
        logger.error(
            "Chat request timed out",
            conversation_id=session.conversation_id,
        )
        raise HTTPException(
            status_code=504,
            detail={
                "error": "timeout",
                "message": "The AI agent took too long to respond. Please try again.",
            },
        )

    except ValueError as e:
        # LLM configuration error
        err = str(e)
        logger.error("Chat configuration error", error=err)
        raise HTTPException(
            status_code=503,
            detail={"error": "llm_not_configured", "message": err},
        )

    except Exception as e:
        err_str = str(e)
        logger.error(
            "Chat processing failed",
            conversation_id=session.conversation_id,
            error=err_str,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "error": "agent_error",
                "message": f"Agent processing failed: {err_str}",
            },
        )


@router.get("/chat/{conversation_id}/history")
async def get_conversation_history(conversation_id: str):
    """Retrieve full message history for a conversation."""
    session = await conversation_store.get(conversation_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Conversation '{conversation_id}' not found or expired."
        )
    return {
        "conversation_id": conversation_id,
        "incident_id": session.incident_id,
        "turn_count": len([m for m in session.messages if m.role == "user"]),
        "messages": [
            {"role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat()}
            for m in session.messages
        ],
        "incident_context": {
            "service": session.incident_context.service,
            "severity": session.incident_context.severity,
            "symptoms": session.incident_context.symptoms,
            "timeline": session.incident_context.timeline,
            "deployment_version": session.incident_context.deployment_version,
        },
        "memory_count": len(session.retrieved_memories),
        "hindsight_searched": session.memory_search_done,
    }


@router.delete("/chat/{conversation_id}")
async def clear_conversation(conversation_id: str):
    """Delete a conversation session."""
    await conversation_store.delete(conversation_id)
    return {"message": f"Conversation {conversation_id} cleared."}


@router.get("/status")
async def agent_status():
    """Agent and conversation store status."""
    settings = get_settings()
    return {
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "llm_configured": settings.llm_is_configured,
        "hindsight_configured": settings.hindsight_is_configured,
        "active_conversations": conversation_store.active_count(),
    }
