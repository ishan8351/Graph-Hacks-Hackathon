"""
Phase 4 Test Suite: FastAPI Server-Sent Events (SSE) Bridge & Multi-Tenant Graph API
====================================================================================
Validates:
1. GET /api/health (FalkorDB connectivity and tenant metadata)
2. POST /api/graph/reset and GET /api/graph/state with multi-tenant isolation
3. GET /api/stream/scenario-a/session-1 and session-2 real-time SSE streaming
   - SSE data payload verification using parse_event()
   - Verification of Graph Stigmergy cross-session state changes
4. GET /api/stream/scenario-b/guardrail real-time SSE streaming
   - Real-time GuardrailTriggeredEvent emission with 3-hop invariant paths
   - Verified BLOCKED_BY_GUARDRAIL terminal status
"""

import json
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.events import (
    AgentStepEvent,
    McpToolCallEvent,
    GraphMutationEvent,
    GuardrailTriggeredEvent,
    SessionCompleteEvent,
    parse_event,
)


@pytest.mark.asyncio
async def test_health_endpoint():
    """Verify /api/health checks FalkorDB connectivity."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("falkordb") == "connected"
        assert "tenants" in data


@pytest.mark.asyncio
async def test_graph_reset_and_state_multi_tenant():
    """Verify multi-tenant reset and state endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Reset tenant alpha
        res_alpha = await client.post(
            "/api/graph/reset",
            json={"tenant_id": "tenant_test_alpha"},
        )
        assert res_alpha.status_code == 200
        data_alpha = res_alpha.json()
        assert "nodes" in data_alpha
        assert "links" in data_alpha
        assert len(data_alpha["nodes"]) >= 40

        # 2. Get state for tenant alpha
        state_alpha = await client.get("/api/graph/state?tenant_id=tenant_test_alpha")
        assert state_alpha.status_code == 200
        state_data = state_alpha.json()
        assert "nodes" in state_data
        assert "links" in state_data
        assert "stats" in state_data
        stats = state_data["stats"]
        assert stats["active_endpoints"] >= 7
        assert stats["deprecated_endpoints"] >= 1


@pytest.mark.asyncio
async def test_stream_scenario_a_session_1_and_2():
    """
    Test real-time SSE streaming for Scenario A Session 1 followed by Session 2.
    Asserts that events adhere to Pydantic contracts and reflect cross-session Stigmergy.
    """
    tenant = "tenant_test_sse_a"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Reset tenant first
        await client.post("/api/graph/reset", json={"tenant_id": tenant})

        # --- Stream Session 1 ---
        events_s1 = []
        async with client.stream("GET", f"/api/stream/scenario-a/session-1?tenant_id={tenant}") as resp_s1:
            assert resp_s1.status_code == 200
            assert "text/event-stream" in resp_s1.headers.get("content-type", "")

            async for line in resp_s1.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        event = parse_event(payload)
                        events_s1.append(event)

        assert len(events_s1) >= 4
        types_s1 = [e.event_type for e in events_s1]
        assert "AGENT_STEP" in types_s1
        assert "MCP_TOOL_CALL" in types_s1
        assert "GRAPH_MUTATION" in types_s1
        assert "SESSION_COMPLETE" in types_s1
        assert any(isinstance(e, AgentStepEvent) for e in events_s1)
        assert any(isinstance(e, McpToolCallEvent) for e in events_s1)
        assert any(isinstance(e, GraphMutationEvent) for e in events_s1)

        term_s1 = [e for e in events_s1 if isinstance(e, SessionCompleteEvent)][0]
        assert term_s1.status == "SUCCESS"

        # --- Stream Session 2 ---
        events_s2 = []
        async with client.stream("GET", f"/api/stream/scenario-a/session-2?tenant_id={tenant}") as resp_s2:
            assert resp_s2.status_code == 200
            assert "text/event-stream" in resp_s2.headers.get("content-type", "")

            async for line in resp_s2.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        event = parse_event(payload)
                        events_s2.append(event)

        assert len(events_s2) >= 3
        types_s2 = [e.event_type for e in events_s2]
        assert "AGENT_STEP" in types_s2
        assert "MCP_TOOL_CALL" in types_s2
        assert "SESSION_COMPLETE" in types_s2
        # Session 2 should have resolved zero-shot (no GraphMutationEvent needed)
        assert "GRAPH_MUTATION" not in types_s2

        term_s2 = [e for e in events_s2 if isinstance(e, SessionCompleteEvent)][0]
        assert term_s2.status == "SUCCESS"

        # --- Stream Session 1 AGAIN (already healed) ---
        events_s1_repeat = []
        async with client.stream("GET", f"/api/stream/scenario-a/session-1?tenant_id={tenant}") as resp_s1_rep:
            assert resp_s1_rep.status_code == 200
            async for line in resp_s1_rep.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        events_s1_repeat.append(parse_event(payload))

        term_s1_rep = [e for e in events_s1_repeat if isinstance(e, SessionCompleteEvent)][0]
        assert term_s1_rep.status == "SUCCESS"

        # --- Stream Session 2 on unhealed tenant ---
        tenant_unhealed = "tenant_test_sse_unhealed"
        await client.post("/api/graph/reset", json={"tenant_id": tenant_unhealed})

        events_s2_unhealed = []
        async with client.stream("GET", f"/api/stream/scenario-a/session-2?tenant_id={tenant_unhealed}") as resp_s2_unh:
            assert resp_s2_unh.status_code == 200
            async for line in resp_s2_unh.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        events_s2_unhealed.append(parse_event(payload))

        term_s2_unh = [e for e in events_s2_unhealed if isinstance(e, SessionCompleteEvent)][0]
        assert term_s2_unh.status == "FAILED"

        # --- Stream Session 2 on empty tenant (never seeded) ---
        tenant_empty = "tenant_test_sse_never_seeded"
        events_s2_empty = []
        async with client.stream("GET", f"/api/stream/scenario-a/session-2?tenant_id={tenant_empty}") as resp_s2_emp:
            assert resp_s2_emp.status_code == 200
            async for line in resp_s2_emp.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        events_s2_empty.append(parse_event(payload))

        term_s2_emp = [e for e in events_s2_empty if isinstance(e, SessionCompleteEvent)][0]
        assert term_s2_emp.status == "FAILED"



@pytest.mark.asyncio
async def test_stream_scenario_b_guardrail():
    """
    Test real-time SSE streaming for Scenario B (3-Hop Constraint Guardrail).
    Asserts that GUARDRAIL_TRIGGERED and BLOCKED_BY_GUARDRAIL are emitted.
    """
    tenant = "tenant_test_sse_b"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Reset tenant first
        await client.post("/api/graph/reset", json={"tenant_id": tenant})

        events_b = []
        async with client.stream("GET", f"/api/stream/scenario-b/guardrail?tenant_id={tenant}") as resp_b:
            assert resp_b.status_code == 200
            assert "text/event-stream" in resp_b.headers.get("content-type", "")

            async for line in resp_b.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        event = parse_event(payload)
                        events_b.append(event)

        assert len(events_b) >= 3
        types_b = [e.event_type for e in events_b]
        assert "GUARDRAIL_TRIGGERED" in types_b
        assert "SESSION_COMPLETE" in types_b

        gr_event = [e for e in events_b if isinstance(e, GuardrailTriggeredEvent)][0]
        assert gr_event.module_name == "PaymentRetryWorker"
        assert gr_event.decision_id == "dec_19"
        assert gr_event.jira_ticket == "PAY-409"
        assert "DO NOT upgrade to /v2/charge/batch" in gr_event.vcs_comment
        assert gr_event.engineer_owner == "Aarav"
        assert len(gr_event.path_nodes) >= 4

        comp_event = [e for e in events_b if isinstance(e, SessionCompleteEvent)][0]
        assert comp_event.status == "BLOCKED_BY_GUARDRAIL"
        assert "Aarav" in comp_event.final_summary


@pytest.mark.asyncio
async def test_stream_scenario_b_without_guardrail():
    """
    Test real-time SSE streaming for Scenario B when no guardrail is triggered
    (clean tenant). Asserts that session completes with SUCCESS.
    """
    tenant = "tenant_test_sse_b_clean"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        events = []
        async with client.stream("GET", f"/api/stream/scenario-b/guardrail?tenant_id={tenant}") as resp:
            assert resp.status_code == 200
            async for line in resp.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        events.append(parse_event(payload))

        types = [e.event_type for e in events]
        assert "SESSION_COMPLETE" in types
        assert "GUARDRAIL_TRIGGERED" not in types
        comp = [e for e in events if isinstance(e, SessionCompleteEvent)][0]
        assert comp.status == "SUCCESS"

