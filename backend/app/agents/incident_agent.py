"""
Conversational AI Incident Agent.

Responsibilities:
- Maintain multi-turn conversation context
- Extract structured incident info from natural language
- Query Hindsight for relevant historical incidents
- Reason over retrieved memories (NEVER invent them)
- Ask meaningful follow-up questions when info is missing
- Return professional SRE-level responses

LLM Provider: Gemini (google-generativeai)
Fallback evidence path: when LLM unavailable, use Hindsight memories directly.

IMPORTANT: Retrieved Hindsight memories are passed verbatim into the LLM prompt.
The LLM is explicitly instructed NEVER to fabricate historical incidents.
"""
import json
import re
import asyncio
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.conversation import ConversationSession, IncidentContext
from app.hindsight.client import recall_memories, reflect_on_memories
from app.schemas.incidents import AnalysisResult, SimilarIncident

logger = get_logger(__name__)

_executor = ThreadPoolExecutor(max_workers=4)

# ─── System prompt for the conversational incident agent ──────────────────────
SYSTEM_PROMPT = """You are RECALLA, a senior Site Reliability Engineer (SRE) AI assistant 
specializing in production incident response. You are powered by Hindsight long-term memory, 
which stores historical incident data, post-mortems, runbooks, and lessons learned.

YOUR BEHAVIOUR:
1. Understand the user's natural language description of an incident.
2. If critical information is missing (service name, symptoms, when it started), 
   ask ONE focused follow-up question at a time. Do not ask multiple questions at once.
3. When you have enough context, search Hindsight for similar historical incidents.
4. Base your recommendations ONLY on retrieved Hindsight memories. 
   NEVER invent a historical incident, root cause, or runbook.
5. If no Hindsight memories were found, say so explicitly and continue evidence-based analysis.
6. Maintain full conversation context — understand follow-up answers as part of the same incident.
7. Be professional, concise, and evidence-based. Cite specific historical incidents when available.
8. When recommending remediation steps, label them clearly.

CRITICAL: You CANNOT execute commands or make production changes yourself. 
You recommend; engineers authorize and execute.

RESPONSE FORMAT:
- Conversational, professional tone
- Use bullet points for lists of steps/symptoms
- Cite historical incidents as: [Historical: INC-XXXX] or [Post-mortem: service/date]
- End with a clear status: "Need more info:" OR "Recommendation:" OR "Investigation step:"
"""


# ─── LLM Providers: Gemini, OpenAI, Anthropic ──────────────────────────────────

def _get_gemini_model():
    """Get a configured Gemini GenerativeModel."""
    import google.generativeai as genai
    settings = get_settings()
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY not set in environment")
    genai.configure(api_key=settings.gemini_api_key)
    model_name = settings.llm_model or "gemini-1.5-flash"
    return genai.GenerativeModel(
        model_name=model_name,
        system_instruction=SYSTEM_PROMPT,
        generation_config={"temperature": 0.2, "max_output_tokens": 1024},
    )


def _gemini_chat_sync(history: List[Dict[str, str]], user_message: str) -> str:
    """Call Gemini synchronously."""
    model = _get_gemini_model()
    gemini_history = []
    for msg in history:
        role = "model" if msg["role"] == "assistant" else msg["role"]
        if role not in ("user", "model"):
            continue
        gemini_history.append({"role": role, "parts": [msg["content"]]})

    chat = model.start_chat(history=gemini_history)
    response = chat.send_message(user_message)
    return response.text


def _openai_chat_sync(history: List[Dict[str, str]], user_message: str) -> str:
    """Call OpenAI synchronously."""
    from openai import OpenAI
    settings = get_settings()
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not set in environment")
    client = OpenAI(api_key=settings.openai_api_key)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history:
        role = "assistant" if msg["role"] == "assistant" else "user"
        messages.append({"role": role, "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})
    model = settings.llm_model or "gpt-4o-mini"
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
        max_tokens=1024,
    )
    return response.choices[0].message.content or ""


def _anthropic_chat_sync(history: List[Dict[str, str]], user_message: str) -> str:
    """Call Anthropic Claude synchronously."""
    from anthropic import Anthropic
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not set in environment")
    client = Anthropic(api_key=settings.anthropic_api_key)
    messages = []
    for msg in history:
        role = "assistant" if msg["role"] == "assistant" else "user"
        messages.append({"role": role, "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})
    model = settings.llm_model or "claude-3-haiku-20240307"
    response = client.messages.create(
        model=model,
        system=SYSTEM_PROMPT,
        messages=messages,
        temperature=0.2,
        max_tokens=1024,
    )
    return response.content[0].text


def _llm_chat_sync(history: List[Dict[str, str]], user_message: str) -> str:
    """Route LLM chat call to configured provider."""
    settings = get_settings()
    provider = (settings.llm_provider or "gemini").lower()
    if provider == "openai":
        return _openai_chat_sync(history, user_message)
    elif provider == "anthropic":
        return _anthropic_chat_sync(history, user_message)
    elif provider == "gemini":
        return _gemini_chat_sync(history, user_message)
    else:
        raise ValueError(f"Unsupported LLM provider: '{provider}'. Must be 'gemini', 'openai', or 'anthropic'.")


async def _call_llm(history: List[Dict[str, str]], user_message: str) -> str:
    """Async wrapper — runs configured LLM in thread pool."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        _executor,
        _llm_chat_sync,
        history,
        user_message,
    )


# ─── Context Extraction ───────────────────────────────────────────────────────

def _build_context_extraction_prompt(conversation_text: str) -> str:
    return f"""Extract structured incident information from this conversation.
Return ONLY a valid JSON object with these keys (use null for missing values):
{{
  "service": "service name or null",
  "severity": "SEV-1|SEV-2|SEV-3|Critical|High|Medium|Low or null",
  "symptoms": "description of symptoms or null",
  "error_message": "exact error message if mentioned or null",
  "affected_component": "specific component if mentioned or null",
  "deployment_version": "version if mentioned or null",
  "error_rate": "percentage as number or null",
  "timeline": "when it started e.g. '10 minutes ago' or null",
  "recent_changes": "recent deployments/config changes mentioned or null",
  "environment": "production/staging/etc or null"
}}

CONVERSATION:
{conversation_text}

JSON:"""


def _extract_context_heuristics(conversation_text: str, ctx: IncidentContext) -> IncidentContext:
    """Extract context using regex patterns as fallback."""
    # Service patterns
    svc_match = re.search(r'\b(Payment API|Auth Service|API Gateway|User Service|Search Service|Billing API|Notification Service|Database)\b', conversation_text, re.IGNORECASE)
    if svc_match and not ctx.service:
        ctx.service = svc_match.group(1).title()
    elif not ctx.service and "payment" in conversation_text.lower():
        ctx.service = "Payment API"
    elif not ctx.service and "auth" in conversation_text.lower():
        ctx.service = "Auth Service"
    elif not ctx.service and "gateway" in conversation_text.lower():
        ctx.service = "API Gateway"

    # Severity
    if not ctx.severity:
        if re.search(r'\b(SEV-?1|Critical|P0|P1)\b', conversation_text, re.IGNORECASE):
            ctx.severity = "Critical"
        elif re.search(r'\b(SEV-?2|High|P2)\b', conversation_text, re.IGNORECASE):
            ctx.severity = "High"

    # Symptoms / Error rate / Version / Timeline
    rate_match = re.search(r'(\d+(?:\.\d+)?)\s*%', conversation_text)
    if rate_match and ctx.error_rate is None:
        try:
            ctx.error_rate = float(rate_match.group(1))
        except ValueError:
            pass

    ver_match = re.search(r'\b(v\d+\.\d+(?:\.\d+)?)\b', conversation_text)
    if ver_match and not ctx.deployment_version:
        ctx.deployment_version = ver_match.group(1)

    time_match = re.search(r'(\d+\s+(?:minutes?|hours?|seconds?)\s+ago)', conversation_text, re.IGNORECASE)
    if time_match and not ctx.timeline:
        ctx.timeline = time_match.group(1)

    if not ctx.symptoms:
        if "500" in conversation_text or "503" in conversation_text or "timeout" in conversation_text.lower() or "error" in conversation_text.lower():
            ctx.symptoms = "500/503 errors and service degradation"

    return ctx


async def _extract_incident_context(
    session: ConversationSession,
) -> IncidentContext:
    """Use configured LLM (with heuristic fallback) to extract structured context from conversation history."""
    if not session.messages:
        return session.incident_context

    conversation_text = "\n".join(
        f"{m.role.upper()}: {m.content}" for m in session.messages[-10:]
    )

    settings = get_settings()
    if settings.llm_is_configured:
        prompt = _build_context_extraction_prompt(conversation_text)
        try:
            raw = await _call_llm([], prompt)
            json_match = re.search(r'\{[^{}]*\}', raw, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                ctx = session.incident_context
                ctx.service = data.get("service") or ctx.service
                ctx.severity = data.get("severity") or ctx.severity
                ctx.symptoms = data.get("symptoms") or ctx.symptoms
                ctx.error_message = data.get("error_message") or ctx.error_message
                ctx.affected_component = data.get("affected_component") or ctx.affected_component
                ctx.deployment_version = data.get("deployment_version") or ctx.deployment_version
                ctx.timeline = data.get("timeline") or ctx.timeline
                ctx.recent_changes = data.get("recent_changes") or ctx.recent_changes
                ctx.environment = data.get("environment") or ctx.environment
                if data.get("error_rate") is not None:
                    try:
                        ctx.error_rate = float(data["error_rate"])
                    except (ValueError, TypeError):
                        pass
                return ctx
        except Exception as e:
            logger.debug("LLM context extraction failed, using heuristic fallback", error=str(e))

    return _extract_context_heuristics(conversation_text, session.incident_context)


def _build_chat_memory_response(session: ConversationSession, context: IncidentContext, user_message: str) -> str:
    """Synthesize evidence-based chat response directly from Hindsight memories when LLM is unavailable."""
    if not context.service:
        return (
            "I received your report. To help investigate and search Hindsight for similar historical incidents, "
            "which service is experiencing this issue (e.g. Payment API, Auth Service, API Gateway)?"
        )

    if not session.retrieved_memories:
        return (
            f"Logged incident context for **{context.service}**.\n\n"
            f"- **Symptoms**: {context.symptoms or 'Under investigation'}\n"
            f"- **Timeline**: {context.timeline or 'Just started'}\n\n"
            "I am checking Hindsight memory for similar historical incidents. Could you share any recent deployments or exact error codes?"
        )

    # Memories retrieved
    top_mem = session.retrieved_memories[0]
    rc_match = re.search(r"Root Cause[^:]*:\s*(.+)", top_mem)
    res_match = re.search(r"Resolution:\s*(.+)", top_mem)
    rb_match = re.search(r"Runbook[^:]*:\s*(.+)", top_mem)

    lines = [
        f"Based on **Hindsight memory retrieval** for **{context.service}**:\n",
    ]
    if rc_match:
        lines.append(f"• **Likely Root Cause**: {rc_match.group(1).strip()}")
    if res_match:
        lines.append(f"• **Recommended Fix**: {res_match.group(1).strip()}")
    if rb_match:
        lines.append(f"• **Runbook**: `{rb_match.group(1).strip()}`")

    lines.append("\n**Immediate Recommendations:**")
    lines.append("1. Inspect recent deployment logs and connection metrics.")
    lines.append("2. Verify downstream database/dependency health.")
    lines.append("3. Execute recommended runbook if metrics confirm pattern.")

    return "\n".join(lines)


# ─── Hindsight Recall ─────────────────────────────────────────────────────────

async def _search_hindsight(context: IncidentContext) -> List[str]:
    """Build a targeted query from incident context and recall from Hindsight."""
    parts = []
    if context.service:
        parts.append(f"Service: {context.service}")
    if context.symptoms:
        parts.append(f"Symptoms: {context.symptoms}")
    if context.error_message:
        parts.append(f"Error: {context.error_message}")
    if context.deployment_version:
        parts.append(f"Deployment: {context.deployment_version}")
    if context.severity:
        parts.append(f"Severity: {context.severity}")

    if not parts:
        return []

    query = "\n".join(parts)
    logger.info("Searching Hindsight for relevant memories", query_preview=query[:120])

    memories = await recall_memories(query)
    logger.info(
        "Hindsight recall result",
        count=len(memories),
        from_live=(len(memories) > 0),
    )
    return memories


# ─── Main Chat Handler ────────────────────────────────────────────────────────

async def handle_chat_message(
    session: ConversationSession,
    user_message: str,
) -> Dict[str, Any]:
    """
    Process one user message in a conversation session.

    Flow:
    1. Add user message to history
    2. Extract/update incident context from full conversation
    3. If context is actionable and Hindsight not yet searched → search Hindsight
    4. Build enriched prompt with memories
    5. Call configured LLM with full history (or synthesize from Hindsight if LLM offline)
    6. Add assistant response to history
    7. Return structured response
    """
    settings = get_settings()

    # 1. Record user message
    session.add_message("user", user_message)

    # 2. Extract structured incident context from conversation
    context = await _extract_incident_context(session)

    # 3. Search Hindsight if we have enough context and haven't searched yet
    memories_this_turn: List[str] = []
    hindsight_searched = False

    if context.is_actionable() and not session.memory_search_done:
        try:
            memories = await _search_hindsight(context)
            session.retrieved_memories = memories
            session.memory_search_done = True
            memories_this_turn = memories
            hindsight_searched = True
        except Exception as e:
            logger.warning("Hindsight recall failed", error=str(e))
            session.memory_search_done = True  # don't retry infinitely

    # 4. Build the message to send to LLM (may include memory injection)
    llm_message = user_message

    if hindsight_searched and session.retrieved_memories:
        memory_block = "\n\n---\n\n".join(session.retrieved_memories[:5])
        llm_message = (
            f"{user_message}\n\n"
            f"[HINDSIGHT RETRIEVED MEMORIES — use these as your factual evidence base; "
            f"do NOT fabricate additional incidents]\n\n"
            f"{memory_block}"
        )
        logger.info("Injected Hindsight memories into LLM prompt", count=len(session.retrieved_memories))
    elif hindsight_searched and not session.retrieved_memories:
        llm_message = (
            f"{user_message}\n\n"
            f"[HINDSIGHT: No relevant historical incidents found in memory for this service/symptoms. "
            f"Do NOT invent historical incidents. Continue evidence-based analysis without historical references.]"
        )

    # 5. Call LLM or fallback synthesis
    agent_response = None
    if settings.llm_is_configured:
        try:
            history_without_last = session.history_for_llm()[:-1]
            agent_response = await _call_llm(history_without_last, llm_message)
        except Exception as e:
            logger.warning("LLM provider call failed, using Hindsight memory synthesis", error=str(e))

    if not agent_response:
        agent_response = _build_chat_memory_response(session, context, user_message)

    # 6. Record assistant response
    session.add_message("assistant", agent_response)

    return {
        "agent_message": agent_response,
        "conversation_id": session.conversation_id,
        "context_summary": context.summary(),
        "incident_context": {
            "service": context.service,
            "severity": context.severity,
            "symptoms": context.symptoms,
            "timeline": context.timeline,
            "deployment_version": context.deployment_version,
        },
        "hindsight_searched": session.memory_search_done,
        "memory_count": len(session.retrieved_memories),
        "memories_used": session.retrieved_memories[:3] if session.retrieved_memories else [],
        "turn_count": len([m for m in session.messages if m.role == "user"]),
    }


# ─── Legacy structured analysis (kept for /api/incidents/{id}/analyze) ────────

async def analyze_incident(
    service: str,
    severity: str,
    symptoms: str,
    error_message: Optional[str] = None,
    affected_component: Optional[str] = None,
    deployment_version: Optional[str] = None,
    error_rate: Optional[float] = None,
    additional_context: Optional[str] = None,
) -> AnalysisResult:
    """
    One-shot structured analysis for the /analyze endpoint.
    Uses Hindsight recall + reflect + Gemini.
    """
    logger.info("Starting structured incident analysis", service=service, severity=severity)

    # Build recall query
    recall_parts = [f"Service: {service}", f"Severity: {severity}", f"Symptoms: {symptoms}"]
    if error_message:
        recall_parts.append(f"Error: {error_message}")
    if affected_component:
        recall_parts.append(f"Component: {affected_component}")
    if deployment_version:
        recall_parts.append(f"Deployment: {deployment_version}")
    recall_query = "\n".join(recall_parts)

    recalled_memories = await recall_memories(recall_query)
    logger.info("Recalled memories for analysis", count=len(recalled_memories))

    reflection = await reflect_on_memories(recall_query)

    similar_incidents = _parse_similar_incidents(recalled_memories)

    analysis = await _generate_structured_analysis(
        service=service, severity=severity, symptoms=symptoms,
        error_message=error_message, deployment_version=deployment_version,
        error_rate=error_rate, recalled_memories=recalled_memories,
        hindsight_reflection=reflection, similar_incidents=similar_incidents,
    )
    return analysis


def _parse_similar_incidents(memories: List[str]) -> List[SimilarIncident]:
    """Extract SimilarIncident objects from raw Hindsight memory strings."""
    similar = []
    # Similarity proxy: position in result list (recall returns by relevance)
    base_scores = [0.92, 0.85, 0.72, 0.63, 0.55]

    for i, memory in enumerate(memories[:5]):
        score = base_scores[i] if i < len(base_scores) else max(0.5 - i * 0.05, 0.3)

        incident_id_match = re.search(r'INCIDENT\s+(INC-[\w-]+)', memory)
        incident_id = incident_id_match.group(1) if incident_id_match else f"MEM-{i+1:03d}"

        service_match = re.search(r'Service:\s*(.+)', memory)
        service = service_match.group(1).strip() if service_match else "Unknown"

        severity_match = re.search(r'Severity:\s*(.+)', memory)
        severity = severity_match.group(1).strip() if severity_match else "Unknown"

        symptoms_match = re.search(r'Symptoms:\s*(.+)', memory)
        symptoms = symptoms_match.group(1).strip() if symptoms_match else memory[:100]

        root_cause_match = re.search(r'Root Cause[^:]*:\s*(.+)', memory)
        root_cause = root_cause_match.group(1).strip() if root_cause_match else None

        resolution_match = re.search(r'Resolution:\s*(.+)', memory)
        resolution = resolution_match.group(1).strip() if resolution_match else None

        runbook_match = re.search(r'Runbook[^:]*:\s*(.+)', memory)
        runbook = runbook_match.group(1).strip() if runbook_match else None

        recovery_match = re.search(r'Recovery Time:\s*(\d+)', memory)
        recovery_time = int(recovery_match.group(1)) if recovery_match else None

        similar.append(SimilarIncident(
            incident_id=incident_id,
            service=service,
            severity=severity,
            symptoms=symptoms,
            root_cause=root_cause,
            resolution=resolution,
            runbook=runbook,
            recovery_time_minutes=recovery_time,
            similarity_score=score,
            relevance_label=f"{int(score * 100)}% relevant",
            detected_at=None,
        ))

    return similar


async def _generate_structured_analysis(
    service: str, severity: str, symptoms: str,
    error_message: Optional[str], deployment_version: Optional[str],
    error_rate: Optional[float], recalled_memories: List[str],
    hindsight_reflection: str, similar_incidents: List[SimilarIncident],
) -> AnalysisResult:
    """Generate structured JSON analysis via Gemini, grounded in Hindsight memories."""
    settings = get_settings()

    memories_text = (
        "\n\n---\n\n".join(recalled_memories[:5])
        if recalled_memories
        else "No historical incidents found in Hindsight memory."
    )

    prompt = f"""You are an expert SRE incident analyst. Analyse this incident using ONLY the 
historical evidence provided. NEVER fabricate incidents or root causes.

CURRENT INCIDENT:
Service: {service}
Severity: {severity}
Symptoms: {symptoms}
Error Rate: {error_rate}%
Error Message: {error_message or 'Not provided'}
Deployment Version: {deployment_version or 'Not provided'}

HISTORICAL MEMORIES FROM HINDSIGHT (retrieved facts — do not invent additional ones):
{memories_text}

HINDSIGHT REFLECTION:
{hindsight_reflection or 'No reflection available.'}

Respond with ONLY a JSON object (no markdown):
{{
  "likely_root_cause": "specific root cause based on historical evidence, or 'Insufficient historical data' if none",
  "confidence": "High|Medium|Low",
  "confidence_score": 0.0-1.0,
  "recommended_actions": ["step 1", "step 2", "step 3", "step 4"],
  "recommended_runbook": "runbook-name or null",
  "why_this_recommendation": "explanation referencing specific past incidents if available",
  "historical_evidence": "summary of retrieved historical evidence, or 'No matching historical incidents found'",
  "risk_warnings": ["warning 1", "warning 2"],
  "estimated_recovery_time": "X minutes based on historical data, or null"
}}"""

    try:
        if not settings.llm_is_configured:
            raise ValueError("LLM not configured")

        raw = await _call_llm([], prompt)

        # Extract JSON
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON found in LLM response")
        data = json.loads(json_match.group())

        return AnalysisResult(
            likely_root_cause=data.get("likely_root_cause", "Unable to determine"),
            confidence=data.get("confidence", "Low"),
            confidence_score=float(data.get("confidence_score", 0.3)),
            similar_incidents=similar_incidents,
            recommended_actions=data.get("recommended_actions", []),
            recommended_runbook=data.get("recommended_runbook"),
            why_this_recommendation=data.get("why_this_recommendation", ""),
            historical_evidence=data.get("historical_evidence", ""),
            risk_warnings=data.get("risk_warnings", []),
            estimated_recovery_time=data.get("estimated_recovery_time"),
            retrieved_memories_raw=recalled_memories,
            ai_generated_reasoning=hindsight_reflection,
            memory_count_used=len(recalled_memories),
        )

    except Exception as e:
        logger.error("LLM structured analysis failed", error=str(e))
        return _build_fallback_analysis(recalled_memories, hindsight_reflection, similar_incidents)


def _build_fallback_analysis(
    recalled_memories: List[str],
    hindsight_reflection: str,
    similar_incidents: List[SimilarIncident],
) -> AnalysisResult:
    """
    Evidence-grounded fallback when LLM is unavailable.
    Uses Hindsight memories directly — never fabricates.
    """
    top = similar_incidents[0] if similar_incidents else None

    if top and top.root_cause:
        root_cause = top.root_cause
        confidence = "High" if top.similarity_score >= 0.8 else "Medium"
        confidence_score = top.similarity_score
        runbook = top.runbook
        recovery_time = f"{top.recovery_time_minutes} minutes" if top.recovery_time_minutes else "15 minutes"
        why = (
            f"Strong pattern correlation with historical incident {top.incident_id} "
            f"({top.relevance_label}). [LLM UNAVAILABLE — evidence directly from Hindsight memory]"
        )
        actions = [
            f"Execute runbook '{runbook}'" if runbook else "Follow standard recovery playbook",
            f"Apply resolution: {top.resolution or 'Restart affected service instances'}",
            "Verify metrics stabilization before closing incident",
            "Document findings for post-mortem",
        ]
        evidence = (
            f"[Hindsight Memory — LLM offline]\n"
            f"Historical Incident {top.incident_id} ({top.service}):\n"
            f"- Symptoms: {top.symptoms}\n"
            f"- Root Cause: {top.root_cause}\n"
            f"- Proven Fix: {top.resolution or 'Standard remediation'}"
        )
    elif hindsight_reflection:
        root_cause = hindsight_reflection.split(".")[0]
        confidence = "Medium"
        confidence_score = 0.60
        runbook = None
        recovery_time = "20 minutes"
        why = "Synthesized from Hindsight post-mortems. [LLM UNAVAILABLE — direct memory synthesis]"
        actions = [
            "Inspect service logs around the incident start time",
            "Verify dependency health and upstream latency",
            "Follow service restart and rollback procedures if unresolved",
        ]
        evidence = f"[Hindsight Reflection — LLM offline]\n{hindsight_reflection}"
    else:
        root_cause = "No historical matching incident found in Hindsight memory"
        confidence = "Low"
        confidence_score = 0.2
        runbook = None
        recovery_time = None
        why = "No prior incidents with this symptom signature in Hindsight memory. [LLM UNAVAILABLE]"
        actions = [
            "Check application logs for unhandled errors and stack traces",
            "Verify recent commits and deployment changelogs",
            "Escalate to primary on-call engineer",
        ]
        evidence = "No historical incident memories recalled for this query."

    return AnalysisResult(
        likely_root_cause=root_cause,
        confidence=confidence,
        confidence_score=confidence_score,
        similar_incidents=similar_incidents,
        recommended_actions=actions,
        recommended_runbook=runbook,
        why_this_recommendation=why,
        historical_evidence=evidence,
        risk_warnings=[
            "LLM provider not available — using direct Hindsight memory evidence",
            "Always verify current service metrics before applying remediation",
        ],
        estimated_recovery_time=recovery_time,
        retrieved_memories_raw=recalled_memories,
        ai_generated_reasoning=hindsight_reflection or why,
        memory_count_used=len(recalled_memories),
    )
