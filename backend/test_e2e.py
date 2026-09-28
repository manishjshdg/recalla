"""End-to-end tests for the real AI + Hindsight pipeline."""
import asyncio
import httpx
import json

BASE = "http://127.0.0.1:8000"
client = httpx.AsyncClient(timeout=60.0)

async def test_health():
    print("\n=== TEST 1: HEALTH ===")
    r = await client.get(f"{BASE}/health")
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"API: {data['api']}")
    print(f"DB: {data['database']}")
    print(f"Hindsight: {data['hindsight']}")
    print(f"LLM: {data['llm']}")
    print(f"Overall: {data['overall']}")
    assert r.status_code == 200
    assert data["api"] == "healthy"
    assert data["database"] == "healthy"
    print("PASS")
    return data

async def test_agent_status():
    print("\n=== TEST 2: AGENT STATUS ===")
    r = await client.get(f"{BASE}/api/agent/status")
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"LLM provider: {data['llm_provider']}")
    print(f"LLM model: {data['llm_model']}")
    print(f"LLM configured: {data['llm_configured']}")
    print(f"Hindsight configured: {data['hindsight_configured']}")
    assert data["llm_configured"] == True, "LLM MUST be configured for this test"
    print("PASS")

async def test_real_ai_turn1():
    print("\n=== TEST 3: REAL AI - TURN 1 ===")
    print("Sending: 'Production is giving 500 errors.'")
    r = await client.post(f"{BASE}/api/agent/chat", json={
        "message": "Production is giving 500 errors.",
        "conversation_id": None,
    })
    data = r.json()
    print(f"Status: {r.status_code}")
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {data}"
    print(f"conversation_id: {data['conversation_id']}")
    print(f"Agent response: {data['agent_message'][:200]}")
    print(f"Turn count: {data['turn_count']}")
    print(f"Hindsight searched: {data['hindsight_searched']}")
    print(f"Memory count: {data['memory_count']}")
    print(f"Context: {data['incident_context']}")
    assert data["conversation_id"], "Must return conversation_id"
    assert data["agent_message"], "Must return agent message"
    assert data["turn_count"] == 1
    print("PASS")
    return data["conversation_id"]

async def test_real_ai_turn2(conversation_id):
    print("\n=== TEST 4: REAL AI - TURN 2 (CONTEXT CONTINUITY) ===")
    print("Sending: 'The payment API.' (follow-up to previous)")
    r = await client.post(f"{BASE}/api/agent/chat", json={
        "message": "The payment API.",
        "conversation_id": conversation_id,
    })
    data = r.json()
    print(f"Status: {r.status_code}")
    assert r.status_code == 200, f"Expected 200: {data}"
    print(f"Same conversation_id: {data['conversation_id'] == conversation_id}")
    print(f"Agent response: {data['agent_message'][:200]}")
    print(f"Turn count: {data['turn_count']}")
    print(f"Context service: {data['incident_context'].get('service')}")
    assert data["conversation_id"] == conversation_id, "Must maintain conversation_id"
    assert data["turn_count"] == 2, "Should be turn 2"
    print("PASS")

async def test_real_ai_turn3(conversation_id):
    print("\n=== TEST 5: REAL AI - TURN 3 + HINDSIGHT RECALL ===")
    print("Sending: 'Yes, it started 10 minutes ago after deployment v2.4.1. Error rate is 87%.'")
    r = await client.post(f"{BASE}/api/agent/chat", json={
        "message": "Yes, it started 10 minutes ago after deployment v2.4.1. Error rate is 87%.",
        "conversation_id": conversation_id,
    })
    data = r.json()
    print(f"Status: {r.status_code}")
    assert r.status_code == 200, f"Expected 200: {data}"
    print(f"Agent response:\n{data['agent_message']}")
    print(f"\nTurn count: {data['turn_count']}")
    print(f"Hindsight searched: {data['hindsight_searched']}")
    print(f"Memory count: {data['memory_count']}")
    if data['memories_used']:
        print(f"First memory snippet: {data['memories_used'][0][:150]}...")
    print(f"Context: {data['incident_context']}")
    assert data["turn_count"] == 3
    print("PASS")

async def test_hindsight_local_recall():
    print("\n=== TEST 6: HINDSIGHT LOCAL MEMORY RECALL ===")
    r = await client.post(f"{BASE}/api/memory/search", json={
        "query": "Payment API database connection timeout deployment"
    })
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"Memories returned: {data['total_count']}")
    if data['memories']:
        print(f"First memory: {data['memories'][0][:200]}")
    assert r.status_code == 200
    assert data["total_count"] > 0, "Local bank should return memories for payment API query"
    print("PASS")

async def test_invalid_request():
    print("\n=== TEST 7: INVALID/EMPTY REQUEST ===")
    r = await client.post(f"{BASE}/api/agent/chat", json={"message": ""})
    print(f"Status: {r.status_code}")
    assert r.status_code == 422, f"Empty message should be rejected with 422, got {r.status_code}"
    print("PASS")

async def test_conversation_history(conversation_id):
    print("\n=== TEST 8: CONVERSATION HISTORY RETRIEVAL ===")
    r = await client.get(f"{BASE}/api/agent/chat/{conversation_id}/history")
    data = r.json()
    print(f"Status: {r.status_code}")
    print(f"Messages in history: {len(data['messages'])}")
    print(f"Turn count: {data['turn_count']}")
    print(f"Context: {data['incident_context']}")
    assert r.status_code == 200
    assert len(data["messages"]) >= 3, "Should have at least 3 messages"
    print("PASS")

async def run_all():
    try:
        await test_health()
        await test_agent_status()
        conv_id = await test_real_ai_turn1()
        await test_real_ai_turn2(conv_id)
        await test_real_ai_turn3(conv_id)
        await test_hindsight_local_recall()
        await test_invalid_request()
        await test_conversation_history(conv_id)
        print("\n" + "="*60)
        print("ALL TESTS PASSED")
        print("="*60)
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
    except Exception as e:
        print(f"\nERROR: {type(e).__name__}: {e}")
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(run_all())
