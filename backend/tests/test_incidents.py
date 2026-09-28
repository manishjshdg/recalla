"""
Backend tests for critical functionality.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Use test database
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_incident_response.db"
os.environ["HINDSIGHT_BASE_URL"] = "http://localhost:8888"
os.environ["OPENAI_API_KEY"] = "test-key"

from app.main import app
from app.models.database import init_db, Base, get_engine


@pytest_asyncio.fixture(scope="session")
async def test_db():
    """Initialize test database."""
    await init_db()
    yield
    # Cleanup
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    import os
    if os.path.exists("test_incident_response.db"):
        os.remove("test_incident_response.db")


@pytest_asyncio.fixture
async def client(test_db):
    """Test HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_check(client):
    """Test health check endpoint returns expected structure."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "api" in data
    assert "database" in data
    assert "hindsight" in data
    assert "llm" in data
    assert "overall" in data
    assert data["api"] == "healthy"
    assert data["database"] == "healthy"


@pytest.mark.asyncio
async def test_create_incident(client):
    """Test incident creation."""
    incident_data = {
        "service": "Payment API",
        "severity": "Critical",
        "symptoms": "503 errors and database timeouts causing payment failures",
        "error_rate": 87.0,
        "deployment_version": "v2.4.1",
    }
    response = await client.post("/api/incidents", json=incident_data)
    assert response.status_code == 201
    data = response.json()
    assert data["service"] == "Payment API"
    assert data["severity"] == "Critical"
    assert data["status"] == "detected"
    assert data["incident_id"].startswith("INC-")
    return data["incident_id"]


@pytest.mark.asyncio
async def test_list_incidents(client):
    """Test listing incidents."""
    response = await client.get("/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_incident(client):
    """Test getting a specific incident."""
    # First create
    incident_data = {
        "service": "Auth Service",
        "severity": "SEV-1",
        "symptoms": "Login failures across all services, JWT validation failing",
        "error_rate": 100.0,
    }
    create_response = await client.post("/api/incidents", json=incident_data)
    assert create_response.status_code == 201
    incident_id = create_response.json()["incident_id"]

    # Then get
    get_response = await client.get(f"/api/incidents/{incident_id}")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["incident_id"] == incident_id
    assert data["service"] == "Auth Service"


@pytest.mark.asyncio
async def test_update_incident_status(client):
    """Test updating incident status."""
    # Create incident
    incident_data = {
        "service": "API Gateway",
        "severity": "High",
        "symptoms": "Rate limiting errors, upstream timeouts",
    }
    create_response = await client.post("/api/incidents", json=incident_data)
    assert create_response.status_code == 201
    incident_id = create_response.json()["incident_id"]

    # Update status
    response = await client.patch(
        f"/api/incidents/{incident_id}/status",
        params={"status": "acknowledged", "details": "Engineer on call acknowledged"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "acknowledged"


@pytest.mark.asyncio
async def test_resolve_incident(client):
    """Test resolving an incident."""
    # Create incident
    incident_data = {
        "service": "User Service",
        "severity": "Medium",
        "symptoms": "Slow response times, database query timeouts",
    }
    create_response = await client.post("/api/incidents", json=incident_data)
    assert create_response.status_code == 201
    incident_id = create_response.json()["incident_id"]

    # Resolve
    resolve_data = {
        "resolution_notes": "Restarted service, queries normalized within 5 minutes",
        "recovery_time_minutes": 12,
    }
    response = await client.post(f"/api/incidents/{incident_id}/resolve", json=resolve_data)
    assert response.status_code == 200
    assert "resolved" in response.json()["message"].lower()


@pytest.mark.asyncio
async def test_create_postmortem(client):
    """Test creating a post-mortem."""
    # Create and resolve incident first
    incident_data = {
        "service": "Payment API",
        "severity": "Critical",
        "symptoms": "Complete payment service outage, all transactions failing",
        "error_rate": 100.0,
    }
    create_response = await client.post("/api/incidents", json=incident_data)
    incident_id = create_response.json()["incident_id"]

    # Resolve
    resolve_data = {
        "resolution_notes": "Rolled back deployment, services restored",
        "recovery_time_minutes": 15,
    }
    await client.post(f"/api/incidents/{incident_id}/resolve", json=resolve_data)

    # Create post-mortem
    pm_data = {
        "incident_summary": "Complete payment service outage due to bad deployment",
        "root_cause": "Memory leak in new async payment handler introduced in latest deployment",
        "what_happened": "Service ran out of memory under load, causing OOM kills",
        "resolution": "Rolled back to previous version, memory stabilized",
        "lessons_learned": "All deployments must include memory profiling under load. OOM alerts must fire earlier.",
        "runbook_used": "payment-db-recovery",
        "recovery_time_minutes": 15,
        "preventive_actions": "Added memory usage to deployment health gates",
    }
    response = await client.post(f"/api/incidents/{incident_id}/postmortem", json=pm_data)
    assert response.status_code == 200
    data = response.json()
    assert data["lessons_learned"] == pm_data["lessons_learned"]


@pytest.mark.asyncio
async def test_analytics_endpoint(client):
    """Test analytics endpoint returns expected structure."""
    response = await client.get("/api/analytics")
    assert response.status_code == 200
    data = response.json()
    assert "total_incidents" in data
    assert "active_incidents" in data
    assert "resolved_incidents" in data
    assert "most_affected_services" in data


@pytest.mark.asyncio
async def test_incident_not_found(client):
    """Test 404 for non-existent incident."""
    response = await client.get("/api/incidents/INC-9999-NOTEXIST")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_invalid_incident_creation(client):
    """Test validation errors on invalid incident data."""
    # Missing required fields
    response = await client.post("/api/incidents", json={"service": "Test"})
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_root_endpoint(client):
    """Test root API endpoint metadata."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "chat_endpoint" in data
    assert data["chat_endpoint"] == "/api/agent/chat"


@pytest.mark.asyncio
async def test_memory_search_and_reflect(client):
    """Test Hindsight memory search, retain, and reflect endpoints."""
    # Test retain
    retain_res = await client.post("/api/memory/retain", json={
        "content": "INCIDENT INC-2026-TEST\nService: Payment API\nSeverity: Critical\nSymptoms: Database timeout\nRoot Cause: Pool exhaustion\nResolution: Increased connection pool size"
    })
    assert retain_res.status_code == 200

    # Test search
    search_res = await client.post("/api/memory/search", json={"query": "Payment API database timeout"})
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert "memories" in search_data
    assert search_data["total_count"] > 0

    # Test reflect
    reflect_res = await client.post("/api/memory/reflect", json={"query": "Payment API connection pool"})
    assert reflect_res.status_code == 200
    reflect_data = reflect_res.json()
    assert "reflection" in reflect_data

    # Test stats
    stats_res = await client.get("/api/memory/stats")
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert "total_memories" in stats_data
    assert "bank_id" in stats_data


@pytest.mark.asyncio
async def test_runbooks_endpoints(client):
    """Test runbooks list and get."""
    response = await client.get("/api/runbooks")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_agent_status_endpoint(client):
    """Test /api/agent/status endpoint."""
    response = await client.get("/api/agent/status")
    assert response.status_code == 200
    data = response.json()
    assert "llm_provider" in data
    assert "llm_model" in data
    assert "llm_configured" in data
    assert "active_conversations" in data


@pytest.mark.asyncio
async def test_agent_chat_validation(client):
    """Test chat endpoint input validation."""
    # Empty message
    response = await client.post("/api/agent/chat", json={"message": ""})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_agent_conversational_flow(client, monkeypatch):
    """Test full multi-turn conversational AI flow with context extraction & memory recall."""
    # Stub _call_llm to simulate LLM responses deterministically during unit test
    import app.agents.incident_agent as agent_module

    call_count = 0
    async def mock_call_llm(history, message):
        nonlocal call_count
        call_count += 1
        # If extracting context:
        if "Extract structured incident information" in message:
            return '{"service": "Payment API", "severity": "SEV-1", "symptoms": "500 errors", "error_rate": 87.0, "deployment_version": "v2.4.1", "timeline": "10 minutes ago"}'
        # If general conversational chat:
        return f"RECALLA response turn {call_count}: Investigating Payment API incident based on Hindsight memory."

    monkeypatch.setattr(agent_module, "_call_llm", mock_call_llm)

    # Override llm_is_configured property during test
    from app.core.config import Settings
    monkeypatch.setattr(Settings, "llm_is_configured", property(lambda self: True))

    # Turn 1: Initial report
    r1 = await client.post("/api/agent/chat", json={
        "message": "Payment API is returning 500 errors in production.",
    })
    assert r1.status_code == 200
    d1 = r1.json()
    conv_id = d1["conversation_id"]
    assert conv_id is not None
    assert d1["turn_count"] == 1
    assert "agent_message" in d1

    # Turn 2: Follow-up message in same conversation
    r2 = await client.post("/api/agent/chat", json={
        "message": "It started 10 minutes ago after deployment v2.4.1. Error rate is 87%.",
        "conversation_id": conv_id,
    })
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["conversation_id"] == conv_id
    assert d2["turn_count"] == 2

    # Verify conversation history endpoint
    r_hist = await client.get(f"/api/agent/chat/{conv_id}/history")
    assert r_hist.status_code == 200
    hist_data = r_hist.json()
    assert hist_data["conversation_id"] == conv_id
    assert len(hist_data["messages"]) >= 4  # 2 user + 2 assistant messages

    # Verify delete conversation
    r_del = await client.delete(f"/api/agent/chat/{conv_id}")
    assert r_del.status_code == 200

    # History should now be 404
    r_hist_after = await client.get(f"/api/agent/chat/{conv_id}/history")
    assert r_hist_after.status_code == 404
