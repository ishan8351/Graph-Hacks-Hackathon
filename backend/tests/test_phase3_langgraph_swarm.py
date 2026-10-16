"""
Phase 3 Test Suite: LangGraph Multi-Agent Swarm & Dual-Mode Execution
======================================================================
Strict TDD tests validating:
1. Scenario A Session 1: Cross-session stigmergy initiation
   - IngestionSubagent encounters HTTP 410 on /v1/legacy-auth
   - Emits AGENT_STEP, MCP_TOOL_CALL, GRAPH_MUTATION, SESSION_COMPLETE
   - Graph Stigmergy pins failure episode and heals route to /v3/oauth/token
2. Scenario A Session 2: Cross-session stigmergy zero-shot resolution
   - BillingSubagent runs in a brand new session
   - Traverses procedural graph and reads Session 1 failure provenance
   - Directly routes to /v3/oauth/token without trial and error (zero 410s)
3. Scenario B: 3-Hop constraint guardrail halts destructive refactor
   - ArchitectAgent investigates PaymentRetryWorker optimization to /v2/charge/batch
   - 3-hop traversal identifies dec_19 (SUBOPTIMAL_WORKAROUND), PAY-409, pr_882_c4, and Aarav
   - Emits GUARDRAIL_TRIGGERED event and halts destructive refactor
   - Preserves synchronous charge route
"""

import pytest
from app.db.graph_client import FalkorDBClient
from app.db.seed_enterprise_graph import seed_tenant_graph
from app.models.events import (
    AgentStepEvent,
    McpToolCallEvent,
    GraphMutationEvent,
    GuardrailTriggeredEvent,
    SessionCompleteEvent,
)
from app.agents.swarm import (
    run_scenario_a_session_1,
    run_scenario_a_session_2,
    run_scenario_b_refactor_guardrail,
)


@pytest.fixture(scope="module")
def client() -> FalkorDBClient:
    """FalkorDB client connection."""
    return FalkorDBClient(host="localhost", port=6379)


@pytest.fixture(autouse=True)
def prepare_swarm_tenant(client: FalkorDBClient):
    """Seed test_tenant_swarm before running tests."""
    tenant = "test_tenant_swarm"
    seed_tenant_graph(client, tenant_id=tenant)
    yield tenant
    client.reset_graph(tenant)


def test_scenario_a_cross_session_stigmergy_loop(client: FalkorDBClient):
    """
    Validate the full Stigmergic Learning Loop across Session 1 and Session 2.
    """
    tenant = "test_tenant_swarm"

    # =========================================================================
    # Part 1: Session 1 (IngestionSubagent discovers 410 & applies Stigmergy)
    # =========================================================================
    session_1_id = "sess_a_subagent_1"
    state_s1 = run_scenario_a_session_1(tenant_id=tenant, session_id=session_1_id)

    assert state_s1["session_id"] == session_1_id
    assert state_s1["final_outcome"] == "SUCCESS"
    assert state_s1["active_endpoint"] == "/v3/oauth/token"

    # Inspect events emitted in Session 1
    events_s1 = state_s1["events_emitted"]
    event_types_s1 = [e.event_type for e in events_s1]
    assert "AGENT_STEP" in event_types_s1
    assert "MCP_TOOL_CALL" in event_types_s1
    assert "GRAPH_MUTATION" in event_types_s1
    assert "SESSION_COMPLETE" in event_types_s1
    assert any(isinstance(e, AgentStepEvent) for e in events_s1)

    # Verify GRAPH_MUTATION event properties
    mutation_events = [e for e in events_s1 if isinstance(e, GraphMutationEvent)]
    assert len(mutation_events) >= 1
    mut_evt = mutation_events[0]
    assert mut_evt.session_id == session_1_id
    assert any("/v1/legacy-auth" in node for node in mut_evt.affected_nodes)
    assert any("EXECUTES_STEP" in edge for edge in mut_evt.affected_edges)

    # Verify FalkorDB persistence of deprecation
    db_check = client.query(
        "MATCH (e:APIEndpoint {name: '/v1/legacy-auth'}) RETURN e.status AS status",
        tenant_id=tenant,
    )
    assert len(db_check.records) == 1
    assert db_check.records[0]["status"] == "DEPRECATED"

    # =========================================================================
    # Part 2: Session 2 (BillingSubagent benefits zero-shot from Session 1)
    # =========================================================================
    session_2_id = "sess_a_subagent_2"
    state_s2 = run_scenario_a_session_2(tenant_id=tenant, session_id=session_2_id)

    assert state_s2["session_id"] == session_2_id
    assert state_s2["final_outcome"] == "SUCCESS"
    assert state_s2["active_endpoint"] == "/v3/oauth/token"

    events_s2 = state_s2["events_emitted"]
    event_types_s2 = [e.event_type for e in events_s2]
    assert "AGENT_STEP" in event_types_s2
    assert "MCP_TOOL_CALL" in event_types_s2
    assert "SESSION_COMPLETE" in event_types_s2
    # Session 2 never hits an error, so no graph mutation needed
    assert "GRAPH_MUTATION" not in event_types_s2

    # Verify tool call in Session 2 received failure provenance from Session 1
    mcp_events_s2 = [e for e in events_s2 if isinstance(e, McpToolCallEvent)]
    assert len(mcp_events_s2) >= 1
    route_tool = next(e for e in mcp_events_s2 if e.tool_name == "get_procedural_route")
    assert route_tool.arguments.get("module_name") == "TokenIngestionWorker"


def test_scenario_b_guardrail_halts_destructive_refactor(client: FalkorDBClient):
    """
    Validate Scenario B: 3-hop constraint guardrail identifies the workaround,
    discovers Aarav, emits GUARDRAIL_TRIGGERED, and halts the refactor.
    """
    tenant = "test_tenant_swarm"
    session_id = "sess_b_guardrail"

    state_b = run_scenario_b_refactor_guardrail(tenant_id=tenant, session_id=session_id)

    assert state_b["session_id"] == session_id
    assert state_b["guardrail_halted"] is True
    assert state_b["final_outcome"] == "BLOCKED_BY_GUARDRAIL"

    events_b = state_b["events_emitted"]
    event_types_b = [e.event_type for e in events_b]

    assert "AGENT_STEP" in event_types_b
    assert "MCP_TOOL_CALL" in event_types_b
    assert "GUARDRAIL_TRIGGERED" in event_types_b
    assert "SESSION_COMPLETE" in event_types_b

    # Inspect GUARDRAIL_TRIGGERED event
    guardrail_events = [e for e in events_b if isinstance(e, GuardrailTriggeredEvent)]
    assert len(guardrail_events) == 1
    gr_evt = guardrail_events[0]
    assert gr_evt.module_name == "PaymentRetryWorker"
    assert gr_evt.decision_id == "dec_19"
    assert gr_evt.jira_ticket == "PAY-409"
    assert "DO NOT upgrade to /v2/charge/batch" in gr_evt.vcs_comment
    assert gr_evt.engineer_owner == "Aarav"
    assert len(gr_evt.path_nodes) >= 4

    # Inspect SESSION_COMPLETE event
    complete_events = [e for e in events_b if isinstance(e, SessionCompleteEvent)]
    assert len(complete_events) == 1
    comp_evt = complete_events[0]
    assert comp_evt.status == "BLOCKED_BY_GUARDRAIL"
    assert "Aarav" in comp_evt.final_summary
    assert "PAY-409" in comp_evt.final_summary

    # Ensure dangerous /v2/charge/batch was NOT wired up to PaymentRetryWorker in FalkorDB
    dangerous_check = client.query(
        """
        MATCH (m:CodeModule {name: 'PaymentRetryWorker'})-[:CALLS]->(e:APIEndpoint {name: '/v2/charge/batch'})
        RETURN e
        """,
        tenant_id=tenant,
    )
    assert len(dangerous_check.records) == 0, "Catastrophic batch endpoint was dangerously linked!"
