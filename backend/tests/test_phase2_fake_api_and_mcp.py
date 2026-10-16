"""
Phase 2 Test Suite: Custom Fake API Gateway & Deterministic MCP Context Service
================================================================================
Validates:
1. FakeMicroserviceGateway deterministic responses and DeprecatedAPIError.
2. MemoryContextController / FastMCP tools:
   - get_procedural_route (initial healthy route vs self-healed stigmergic route)
   - log_failed_task (atomic Cypher Graph Stigmergy mutation)
   - trace_design_decision (3-hop constraint guardrail with ADR, Jira, VCS, engineer)
   - find_domain_expert (graph centrality traversal)
"""

import pytest
from app.db.graph_client import FalkorDBClient
from app.db.seed_enterprise_graph import seed_tenant_graph
from app.services.fake_api_gateway import FakeMicroserviceGateway, DeprecatedAPIError
from app.mcp.memory_mcp import MemoryContextController


@pytest.fixture(scope="module")
def client() -> FalkorDBClient:
    """Connected FalkorDB client."""
    return FalkorDBClient(host="localhost", port=6379)


@pytest.fixture(scope="module")
def gateway() -> FakeMicroserviceGateway:
    """Deterministic custom mock microservice gateway."""
    return FakeMicroserviceGateway()


@pytest.fixture(scope="module")
def controller(client: FalkorDBClient) -> MemoryContextController:
    """MCP Memory Context controller."""
    return MemoryContextController(client=client)


@pytest.fixture(autouse=True)
def prepare_test_tenant(client: FalkorDBClient):
    """Seed test_tenant_phase2 before each test."""
    tenant = "test_tenant_phase2"
    seed_tenant_graph(client, tenant_id=tenant)
    yield tenant
    client.reset_graph(tenant)


def test_fake_api_gateway_deprecated_endpoint(gateway: FakeMicroserviceGateway):
    """Assert /v1/legacy-auth raises DeprecatedAPIError (HTTP 410) with migration advice."""
    with pytest.raises(DeprecatedAPIError) as exc_info:
        gateway.call(endpoint="/v1/legacy-auth", method="POST")

    err = exc_info.value
    assert err.status_code == 410
    assert err.error_code == "HTTP_410_GONE"
    assert err.recommended_replacement == "/v3/oauth/token"
    assert "discontinued" in str(err) or "Migrate to /v3/oauth/token" in str(err)


def test_fake_api_gateway_endpoints(gateway: FakeMicroserviceGateway):
    """Test standard endpoints on FakeMicroserviceGateway."""
    # 1. OAuth V3 Token
    oauth_res = gateway.call("/v3/oauth/token", method="POST")
    assert oauth_res["status"] == 200
    assert "token" in oauth_res
    assert oauth_res["latency_ms"] == 35

    # 2. Synchronous Single Charge (Valid)
    charge_res = gateway.call("/v1/charge/sync", method="POST", payload={"amount": 100})
    assert charge_res["status"] == 200
    assert charge_res["tx_id"] == "tx_sync_99"
    assert charge_res["webhook_delivered"] is True

    # 3. Batch Charge (Simulates Catastrophic Bug)
    batch_res = gateway.call("/v2/charge/batch", method="POST", payload={"items": [1, 2]})
    assert batch_res["status"] == 502
    assert batch_res["error"] == "BANK_WEBHOOK_DROPPED"
    assert "dropped settlement webhooks" in batch_res["message"]

    # 4. Unrecognized Endpoint
    with pytest.raises(ValueError):
        gateway.call("/api/unknown/endpoint")


def test_stigmergy_and_self_healing_route_switch(
    client: FalkorDBClient,
    gateway: FakeMicroserviceGateway,
    controller: MemoryContextController,
):
    """
    Test the complete Stigmergy & Self-Healing Loop:
    1. Initially TokenIngestionWorker routes to /v1/legacy-auth (PRIMARY).
    2. Calling /v1/legacy-auth triggers HTTP 410 DeprecatedAPIError.
    3. Controller logs failed task with Graph Stigmergy mutation.
    4. Subsequent procedural route query self-heals to /v3/oauth/token with failure provenance.
    """
    tenant = "test_tenant_phase2"

    # Step 1: Initial procedural route check
    route_init = controller.get_procedural_route(
        module_name="TokenIngestionWorker",
        tenant_id=tenant,
    )
    assert route_init["active_endpoint"] == "/v1/legacy-auth"
    assert route_init["route_type"] == "PRIMARY"
    assert route_init["status"] == "ACTIVE"
    assert route_init["failure_provenance"] is None

    # Step 2: Attempt operational call and catch 410 error
    error_captured = None
    try:
        gateway.call(route_init["active_endpoint"], method="POST")
    except DeprecatedAPIError as e:
        error_captured = e

    assert error_captured is not None

    # Step 3: Graph Stigmergy Mutation
    mutation = controller.log_failed_task(
        agent_name="SelfHealingRefactorAgent",
        session_id="sess_stigmergy_001",
        module_name="TokenIngestionWorker",
        failed_endpoint=route_init["active_endpoint"],
        error_message=str(error_captured),
        replacement_endpoint=error_captured.recommended_replacement,
        tenant_id=tenant,
    )
    assert mutation["status"] == "MUTATED"
    assert "episode_id" in mutation
    assert len(mutation["affected_nodes"]) > 0
    assert len(mutation["affected_edges"]) > 0

    # Step 4: Verify that the graph now immediately self-heals to /v3/oauth/token
    route_healed = controller.get_procedural_route(
        module_name="TokenIngestionWorker",
        tenant_id=tenant,
    )
    assert route_healed["active_endpoint"] == "/v3/oauth/token"
    assert route_healed["route_type"] == "SELF_HEALED"
    assert route_healed["status"] == "ACTIVE"
    assert route_healed["failure_provenance"] is not None
    assert "discontinued" in route_healed["failure_provenance"]["error"]
    assert route_healed["failure_provenance"]["session_id"] == "sess_stigmergy_001"


def test_trace_design_decision_guardrail(controller: MemoryContextController):
    """
    Test 3-hop constraint guardrail retrieval:
    (PaymentRetryWorker)-[:IMPLEMENTS]->(dec_19)-[:FORCED_BY]->(PAY-409)-[:EXPLAINED_IN]->(pr_882_c4)<-[:AUTHORED]-(Aarav)
    """
    tenant = "test_tenant_phase2"
    trace = controller.trace_design_decision(
        module_name="PaymentRetryWorker",
        tenant_id=tenant,
    )
    assert trace["guardrail_active"] is True
    assert trace["decision"]["id"] == "dec_19"
    assert trace["decision"]["status"] == "SUBOPTIMAL_WORKAROUND"
    assert "single-item polling" in trace["decision"]["summary"]
    assert trace["jira_ticket"]["id"] == "PAY-409"
    assert trace["vcs_comment"]["id"] == "pr_882_c4"
    assert "DO NOT upgrade to /v2/charge/batch" in trace["vcs_comment"]["text"]
    assert trace["engineer"]["name"] == "Aarav"
    assert trace["engineer"]["role"] == "Staff Systems Architect"
    assert len(trace["path_nodes"]) >= 4
    assert "cypher_executed" in trace


def test_find_domain_expert(controller: MemoryContextController):
    """Test graph centrality traversal to find the lead domain expert for a module."""
    tenant = "test_tenant_phase2"
    expert = controller.find_domain_expert(
        module_name="PaymentRetryWorker",
        tenant_id=tenant,
    )
    assert expert["expert_name"] == "Aarav"
    assert expert["role"] == "Staff Systems Architect"
    assert expert["email"] == "aarav@enterprise.internal"
    assert expert["centrality_score"] > 0
    assert len(expert["relations"]) > 0
    assert "cypher_executed" in expert
