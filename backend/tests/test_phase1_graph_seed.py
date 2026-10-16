"""
Phase 1 Test Suite: FalkorDB Multigraph Client & Synthetic Seed Engine
======================================================================
Strict TDD tests validating:
1. Multigraph tenant isolation (separate graphs for separate tenants).
2. FalkorDBClient query execution, latency measurement, and reset operations.
3. Realistic enterprise synthetic seed topology:
   - 40 to 60 total connected nodes
   - Canonical 3-hop constraint guardrail (PaymentRetryWorker -> dec_19 -> PAY-409 -> pr_882_c4 <- Aarav)
   - Canonical self-healing procedural workflow (TokenIngestionWorker -> legacy auth -> OAuth v3)
   - Engineer collaboration network with Aarav possessing highest billing-core centrality
4. UI topology extraction (nodes + links structure).
"""

import pytest
from app.db.graph_client import FalkorDBClient
from app.db.seed_enterprise_graph import seed_tenant_graph


@pytest.fixture(scope="module")
def client() -> FalkorDBClient:
    """Instantiate a FalkorDB client pointing to test instance."""
    db_client = FalkorDBClient(host="localhost", port=6379)
    return db_client


@pytest.fixture(autouse=True)
def cleanup_test_tenants(client: FalkorDBClient):
    """Ensure test tenants are safely cleaned up before and after tests."""
    tenants = ["test_tenant_a", "test_tenant_b", "test_tenant_seed", "test_tenant_topo"]
    for t in tenants:
        client.reset_graph(t)
    yield
    for t in tenants:
        client.reset_graph(t)


def test_multigraph_tenant_isolation(client: FalkorDBClient):
    """Verify that mutations in test_tenant_a are completely isolated from test_tenant_b."""
    client.reset_graph("test_tenant_a")
    client.reset_graph("test_tenant_b")

    # Insert node into tenant A
    client.query(
        "CREATE (n:Service {id: 'svc_a', name: 'AlphaService'})",
        tenant_id="test_tenant_a",
    )

    # Insert different node into tenant B
    client.query(
        "CREATE (n:Service {id: 'svc_b', name: 'BetaService'})",
        tenant_id="test_tenant_b",
    )

    # Query tenant A
    res_a = client.query("MATCH (n:Service) RETURN n.id AS id, n.name AS name", tenant_id="test_tenant_a")
    assert len(res_a.records) == 1
    assert res_a.records[0]["id"] == "svc_a"
    assert res_a.latency_ms >= 0.0

    # Query tenant B
    res_b = client.query("MATCH (n:Service) RETURN n.id AS id, n.name AS name", tenant_id="test_tenant_b")
    assert len(res_b.records) == 1
    assert res_b.records[0]["id"] == "svc_b"


def test_seed_tenant_graph_counts_and_structure(client: FalkorDBClient):
    """Verify that seed_tenant_graph generates an enterprise topology with 40-60 nodes."""
    tenant = "test_tenant_seed"
    seed_result = seed_tenant_graph(client, tenant_id=tenant)
    assert seed_result.get("status") == "SUCCESS"

    # Verify node count is in 40-60 range
    node_count_res = client.query("MATCH (n) RETURN count(n) AS node_count", tenant_id=tenant)
    node_count = node_count_res.records[0]["node_count"]
    assert 40 <= node_count <= 60, f"Expected node count between 40 and 60, got {node_count}"

    # Verify relationship count
    edge_count_res = client.query("MATCH ()-[r]->() RETURN count(r) AS edge_count", tenant_id=tenant)
    edge_count = edge_count_res.records[0]["edge_count"]
    assert edge_count >= 50, f"Expected at least 50 relationships, got {edge_count}"

    # Verify key node categories are present
    categories = {
        "Service": 3,
        "APIEndpoint": 8,
        "JiraTicket": 6,
        "VCSComment": 8,
        "Engineer": 4,
        "Decision": 3,
    }
    for label, min_expected in categories.items():
        res = client.query(f"MATCH (n:{label}) RETURN count(n) AS cnt", tenant_id=tenant)
        cnt = res.records[0]["cnt"]
        assert cnt >= min_expected, f"Expected at least {min_expected} nodes with label {label}, got {cnt}"


def test_3_hop_constraint_guardrail_traversal(client: FalkorDBClient):
    """
    Test the canonical 3-hop constraint guardrail path:
    (PaymentRetryWorker)-[:IMPLEMENTS]->(dec_19)-[:FORCED_BY]->(PAY-409)-[:EXPLAINED_IN]->(pr_882_c4)<-[:AUTHORED]-(Aarav)
    """
    tenant = "test_tenant_seed"
    seed_tenant_graph(client, tenant_id=tenant)

    cypher = """
    MATCH (mod:CodeModule {name: 'PaymentRetryWorker'})-[:IMPLEMENTS]->(dec:Decision {id: 'dec_19'})
    MATCH (dec)-[:FORCED_BY]->(jira:JiraTicket {id: 'PAY-409'})
    MATCH (jira)-[:EXPLAINED_IN]->(vcs:VCSComment {id: 'pr_882_c4'})
    MATCH (vcs)<-[:AUTHORED]-(eng:Engineer {name: 'Aarav'})
    RETURN mod.name AS module_name,
           dec.id AS decision_id,
           dec.status AS decision_status,
           jira.id AS jira_id,
           vcs.id AS vcs_id,
           vcs.text AS warning_text,
           eng.name AS engineer_name,
           eng.role AS engineer_role
    """
    res = client.query(cypher, tenant_id=tenant)
    assert len(res.records) == 1, "Failed to traverse the canonical 3-hop guardrail pattern"
    row = res.records[0]
    assert row["module_name"] == "PaymentRetryWorker"
    assert row["decision_id"] == "dec_19"
    assert row["decision_status"] == "SUBOPTIMAL_WORKAROUND"
    assert row["jira_id"] == "PAY-409"
    assert row["vcs_id"] == "pr_882_c4"
    assert "DO NOT upgrade to /v2/charge/batch" in row["warning_text"]
    assert row["engineer_name"] == "Aarav"
    assert row["engineer_role"] == "Staff Systems Architect"


def test_self_healing_procedural_workflow_topology(client: FalkorDBClient):
    """
    Test the self-healing procedural workflow topology:
    (TokenIngestionWorker)-[:EXECUTES_STEP]->(/v1/legacy-auth)
    (TokenIngestionWorker)-[:FALLBACK_STEP]->(/v3/oauth/token)
    (/v1/legacy-auth)-[:SUPERSEDED_BY]->(/v3/oauth/token)
    """
    tenant = "test_tenant_seed"
    seed_tenant_graph(client, tenant_id=tenant)

    cypher = """
    MATCH (mod:CodeModule {name: 'TokenIngestionWorker'})-[rStep:EXECUTES_STEP]->(legacy:APIEndpoint {name: '/v1/legacy-auth'})
    MATCH (mod)-[rFallback:FALLBACK_STEP]->(v3:APIEndpoint {name: '/v3/oauth/token'})
    MATCH (legacy)-[rSup:SUPERSEDED_BY]->(v3)
    RETURN mod.name AS worker,
           legacy.name AS legacy_endpoint,
           rStep.status AS step_status,
           rStep.weight AS step_weight,
           v3.name AS v3_endpoint,
           rFallback.status AS fallback_status,
           rSup.confidence AS supersedence_confidence
    """
    res = client.query(cypher, tenant_id=tenant)
    assert len(res.records) == 1, "Failed to find self-healing procedural workflow topology"
    row = res.records[0]
    assert row["worker"] == "TokenIngestionWorker"
    assert row["legacy_endpoint"] == "/v1/legacy-auth"
    assert row["v3_endpoint"] == "/v3/oauth/token"
    assert row["step_status"] == "ACTIVE"
    assert row["fallback_status"] == "STANDBY"
    assert row["supersedence_confidence"] == 1.0


def test_engineer_collaboration_centrality(client: FalkorDBClient):
    """Verify that Aarav has highest centrality in the billing domain."""
    tenant = "test_tenant_seed"
    seed_tenant_graph(client, tenant_id=tenant)

    # Count all relationships connected to each engineer in the graph
    cypher = """
    MATCH (eng:Engineer)-[r]-()
    RETURN eng.name AS engineer_name, count(r) AS degree_centrality
    ORDER BY degree_centrality DESC
    """
    res = client.query(cypher, tenant_id=tenant)
    assert len(res.records) == 4
    top_engineer = res.records[0]["engineer_name"]
    assert top_engineer == "Aarav", f"Expected Aarav to have highest centrality, found {top_engineer}"
    assert res.records[0]["degree_centrality"] > res.records[1]["degree_centrality"]


def test_get_full_topology_format(client: FalkorDBClient):
    """Verify get_full_topology returns nodes and links properly structured for graph visualizers."""
    tenant = "test_tenant_topo"
    client.reset_graph(tenant)
    client.query(
        "CREATE (a:Service {id: 'svc_1', name: 'Billing'})-[r:CALLS {protocol: 'grpc'}]->(b:Service {id: 'svc_2', name: 'Auth'})",
        tenant_id=tenant,
    )

    topology = client.get_full_topology(tenant_id=tenant)
    assert "nodes" in topology
    assert "links" in topology
    assert len(topology["nodes"]) == 2
    assert len(topology["links"]) == 1

    node = topology["nodes"][0]
    assert "id" in node
    assert "label" in node
    assert "labels" in node
    assert "properties" in node
    assert node["label"] == "Service"

    link = topology["links"][0]
    assert "id" in link
    assert "source" in link
    assert "target" in link
    assert "type" in link
    assert "properties" in link
    assert link["type"] == "CALLS"
    assert link["properties"].get("protocol") == "grpc"
