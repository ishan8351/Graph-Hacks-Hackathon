"""
Phase 6 End-to-End Test Suite: 2-Minute Winning Demo Flow
==========================================================
Validates the complete Active Engineering Memory Layer end-to-end:
1. Health check verification.
2. 1-Click Graph Reset & Seed for tenant_project_alpha.
3. Act 1: Session 1 (IngestionSubagent hits HTTP 410, writes Graph Stigmergy).
4. Act 1: Session 2 (BillingSubagent zero-shots /v3/oauth/token in < 2 seconds).
5. Act 2: Guardrail Traversal (ArchitectAgent halts /v2/charge/batch upgrade).
6. Final graph state and statistics inspection.
"""

import json
import time
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
async def test_full_2_minute_demo_flow_end_to_end():
    """Execute the full 2-minute hackathon winning demo script end-to-end."""
    tenant = "tenant_project_alpha"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # =====================================================================
        # Step 1: Health Check
        # =====================================================================
        health_resp = await client.get("/api/health")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["status"] == "healthy"
        assert health_data["falkordb"] == "connected"

        # =====================================================================
        # Step 2: 1-Click Graph Reset & Seed for tenant_project_alpha
        # =====================================================================
        reset_resp = await client.post("/api/graph/reset", json={"tenant_id": tenant})
        assert reset_resp.status_code == 200
        reset_data = reset_resp.json()
        assert reset_data["status"] == "SUCCESS"
        assert reset_data["tenant_id"] == tenant
        assert len(reset_data["nodes"]) >= 40
        assert len(reset_data["links"]) >= 50

        # =====================================================================
        # Step 3: Act 1 Session 1 (Discovery & Graph Stigmergy)
        # =====================================================================
        events_s1 = []
        async with client.stream(
            "GET", f"/api/stream/scenario-a/session-1?tenant_id={tenant}"
        ) as resp_s1:
            assert resp_s1.status_code == 200
            async for line in resp_s1.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        events_s1.append(parse_event(payload))

        # Assert Session 1 flow
        assert len(events_s1) >= 4
        s1_types = [e.event_type for e in events_s1]
        assert "AGENT_STEP" in s1_types
        assert "MCP_TOOL_CALL" in s1_types
        assert "GRAPH_MUTATION" in s1_types
        assert "SESSION_COMPLETE" in s1_types
        assert any(isinstance(e, AgentStepEvent) for e in events_s1)
        assert any(isinstance(e, McpToolCallEvent) for e in events_s1)

        mut_event = next(e for e in events_s1 if isinstance(e, GraphMutationEvent))
        assert any("/v1/legacy-auth" in n for n in mut_event.affected_nodes)
        assert any("EXECUTES_STEP" in edge for edge in mut_event.affected_edges)

        complete_s1 = next(e for e in events_s1 if isinstance(e, SessionCompleteEvent))
        assert complete_s1.status == "SUCCESS"

        # =====================================================================
        # Step 4: Act 1 Session 2 (Zero-Shot Self-Healing Inheritance)
        # =====================================================================
        start_time_s2 = time.perf_counter()
        events_s2 = []
        async with client.stream(
            "GET", f"/api/stream/scenario-a/session-2?tenant_id={tenant}"
        ) as resp_s2:
            assert resp_s2.status_code == 200
            async for line in resp_s2.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        events_s2.append(parse_event(payload))

        s2_duration = time.perf_counter() - start_time_s2
        assert s2_duration < 2.0, f"Session 2 should execute in < 2 seconds, took {s2_duration}s"

        # Assert Session 2 zero-shot resolution
        s2_types = [e.event_type for e in events_s2]
        assert "AGENT_STEP" in s2_types
        assert "MCP_TOOL_CALL" in s2_types
        assert "SESSION_COMPLETE" in s2_types
        assert "GRAPH_MUTATION" not in s2_types, "Session 2 should resolve zero-shot without mutating graph!"

        complete_s2 = next(e for e in events_s2 if isinstance(e, SessionCompleteEvent))
        assert complete_s2.status == "SUCCESS"

        # =====================================================================
        # Step 5: Act 2 (3-Hop Constraint Guardrail Abort)
        # =====================================================================
        events_b = []
        async with client.stream(
            "GET", f"/api/stream/scenario-b/guardrail?tenant_id={tenant}"
        ) as resp_b:
            assert resp_b.status_code == 200
            async for line in resp_b.aiter_lines():
                if line.startswith("data:"):
                    payload_str = line[len("data:"):].strip()
                    if payload_str:
                        payload = json.loads(payload_str)
                        events_b.append(parse_event(payload))

        b_types = [e.event_type for e in events_b]
        assert "GUARDRAIL_TRIGGERED" in b_types
        assert "SESSION_COMPLETE" in b_types

        gr_event = next(e for e in events_b if isinstance(e, GuardrailTriggeredEvent))
        assert gr_event.module_name == "PaymentRetryWorker"
        assert gr_event.decision_id == "dec_19"
        assert gr_event.jira_ticket == "PAY-409"
        assert "DO NOT upgrade to /v2/charge/batch" in gr_event.vcs_comment
        assert gr_event.engineer_owner == "Aarav"
        assert len(gr_event.path_nodes) >= 4

        complete_b = next(e for e in events_b if isinstance(e, SessionCompleteEvent))
        assert complete_b.status == "BLOCKED_BY_GUARDRAIL"

        # =====================================================================
        # Step 6: Verify Final Graph State in FalkorDB
        # =====================================================================
        state_resp = await client.get(f"/api/graph/state?tenant_id={tenant}")
        assert state_resp.status_code == 200
        state_data = state_resp.json()

        stats = state_data["stats"]
        assert stats["logged_episodes"] >= 1
        assert stats["deprecated_endpoints"] >= 1
        assert stats["active_endpoints"] >= 6
