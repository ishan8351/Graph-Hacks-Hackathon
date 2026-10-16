"""
Active Engineering Memory Layer - FastMCP Context Service & Stigmergy Controller
================================================================================
Implements the core socio-technical graph reasoning and memory capabilities:
1. Procedural Edge Routing: Determines whether a module's execution path is healthy
   (PRIMARY) or has been superseded/healed via Graph Stigmergy (SELF_HEALED).
2. Graph Stigmergy Task Failure Logging: Atomically blocks failing routes, creates
   failure episodes, establishes superseding edges, and heals active execution steps.
3. 3-Hop Constraint Guardrail Retrieval: Traverses ADRs, Jira postmortems, VCS code
   review warnings, and authoring engineers to enforce architectural invariants.
4. Domain Expert Discovery: Discovers authoritative architects based on graph centrality
   over authorship, ownership, and maintenance relationships.

Both class-based (MemoryContextController) and MCP server tool decorator (@mcp.tool)
interfaces are provided for seamless embedding in LangGraph and FastMCP agents.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid

from mcp.server.fastmcp import FastMCP

from app.db.graph_client import FalkorDBClient

# FastMCP Server Instance
mcp = FastMCP("ActiveEngineeringMemory")


class MemoryContextController:
    """
    Controller executing deterministic graph traversals and mutations against FalkorDB.
    """

    def __init__(self, client: Optional[FalkorDBClient] = None):
        self.client = client or FalkorDBClient()

    def get_procedural_route(
        self,
        module_name: str,
        tenant_id: str = "active_memory_default",
    ) -> Dict[str, Any]:
        """
        Determine the operational execution route for a code module.
        Checks if the primary route is healthy or if Graph Stigmergy has activated
        a self-healed alternative route.

        Args:
            module_name: Name of the worker module (e.g. 'TokenIngestionWorker').
            tenant_id: Graph tenant namespace.

        Returns:
            Dictionary containing active endpoint, status, route_type, failure provenance, and Cypher query.
        """
        # Step 1: Check primary execution step status and failure signals
        primary_cypher = """
        MATCH (m:CodeModule {name: $module_name})-[r:EXECUTES_STEP]->(api:APIEndpoint)
        OPTIONAL MATCH (f:Failure)-[:DEPRECATES]->(api)
        RETURN api.name AS endpoint,
               api.status AS api_status,
               r.status AS step_status,
               r.weight AS step_weight,
               r.self_healed AS self_healed,
               f.id AS failure_id,
               f.session_id AS session_id,
               f.error AS failure_error,
               f.timestamp AS failure_ts
        ORDER BY r.weight DESC, r.self_healed DESC
        """
        primary_res = self.client.query(primary_cypher, {"module_name": module_name}, tenant_id=tenant_id)
        
        # If no steps found at all, return UNKNOWN
        if not primary_res.records:
            return {
                "active_endpoint": None,
                "status": "NOT_FOUND",
                "route_type": "UNKNOWN",
                "reason": f"No procedural execution steps registered for module '{module_name}'",
                "failure_provenance": None,
                "cypher_executed": primary_cypher,
            }

        # Check if the highest weighted step is ACTIVE and has no DEPRECATES failure edge
        top_row = primary_res.records[0]
        is_primary_active = (
            top_row["step_status"] == "ACTIVE"
            and not top_row.get("failure_id")
            and top_row.get("api_status") != "DEPRECATED"
            and not top_row.get("self_healed")
        )

        if is_primary_active:
            return {
                "active_endpoint": top_row["endpoint"],
                "status": "ACTIVE",
                "route_type": "PRIMARY",
                "reason": "Primary procedural step is active and verified healthy.",
                "failure_provenance": None,
                "cypher_executed": primary_cypher,
            }

        # Step 2: Primary route is deprecated or blocked. Traverse self-healing graph structure
        healed_cypher = """
        MATCH (m:CodeModule {name: $module_name})
        OPTIONAL MATCH (m)-[rActive:EXECUTES_STEP {status: 'ACTIVE'}]->(activeApi:APIEndpoint)
        OPTIONAL MATCH (m)-[:FALLBACK_STEP]->(fallbackApi:APIEndpoint)
        OPTIONAL MATCH (m)-[:EXECUTES_STEP]->(oldApi:APIEndpoint)-[:SUPERSEDED_BY]->(supersedingApi:APIEndpoint)
        OPTIONAL MATCH (f:Failure)-[:DEPRECATES]->(oldApi)
        RETURN coalesce(activeApi.name, supersedingApi.name, fallbackApi.name) AS healed_endpoint,
               oldApi.name AS deprecated_endpoint,
               f.id AS episode_id,
               f.session_id AS session_id,
               f.error AS error_message,
               f.timestamp AS timestamp
        ORDER BY rActive.weight DESC
        LIMIT 1
        """
        healed_res = self.client.query(healed_cypher, {"module_name": module_name}, tenant_id=tenant_id)

        if healed_res.records and healed_res.records[0].get("healed_endpoint"):
            h_row = healed_res.records[0]
            provenance = None
            if h_row.get("episode_id"):
                provenance = {
                    "episode_id": h_row["episode_id"],
                    "session_id": h_row.get("session_id"),
                    "error": h_row.get("error_message"),
                    "timestamp": h_row.get("timestamp"),
                }
            return {
                "active_endpoint": h_row["healed_endpoint"],
                "status": "ACTIVE",
                "route_type": "SELF_HEALED",
                "reason": (
                    f"Self-healed procedural route selected. Previous route "
                    f"'{h_row.get('deprecated_endpoint')}' was deprecated via Graph Stigmergy."
                ),
                "failure_provenance": provenance,
                "cypher_executed": healed_cypher,
            }

        # Fallback if neither primary nor healed route found
        return {
            "active_endpoint": top_row["endpoint"],
            "status": top_row["step_status"],
            "route_type": "DEGRADED",
            "reason": "Module procedural route is blocked and no valid fallback endpoint was resolved.",
            "failure_provenance": None,
            "cypher_executed": healed_cypher,
        }

    def log_failed_task(
        self,
        agent_name: str,
        session_id: str,
        module_name: str,
        failed_endpoint: str,
        error_message: str,
        replacement_endpoint: str,
        tenant_id: str = "active_memory_default",
    ) -> Dict[str, Any]:
        """
        Atomic Graph Stigmergy Mutation:
        1. Marks the failed EXECUTES_STEP as BLOCKED (weight: 0.0) and old API as DEPRECATED.
        2. Logs the failure episode linked to the acting agent.
        3. Connects the failure episode to old API with a DEPRECATES relationship.
        4. Links old API to replacement API via SUPERSEDED_BY edge (confidence: 1.0).
        5. Instantiates new self-healed EXECUTES_STEP to replacement API (weight: 1.0, status: ACTIVE).
        """
        ep_id = f"ep_{uuid.uuid4().hex[:8]}"
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        mutation_cypher = """
        MATCH (m:CodeModule {name: $module_name})-[r:EXECUTES_STEP]->(oldApi:APIEndpoint {name: $failed_endpoint})
        SET r.status = 'BLOCKED', r.weight = 0.0, oldApi.status = 'DEPRECATED'
        MERGE (a:Agent {name: $agent_name})
        CREATE (f:Failure {id: $ep_id, session_id: $session_id, error: $error_message, timestamp: $ts})
        CREATE (a)-[:LOGGED_EPISODE]->(f)
        CREATE (f)-[:DEPRECATES {weight: 0.0}]->(oldApi)
        MERGE (newApi:APIEndpoint {name: $replacement_endpoint})
        MERGE (oldApi)-[rSup:SUPERSEDED_BY]->(newApi)
        SET rSup.confidence = 1.0
        CREATE (m)-[:EXECUTES_STEP {status: 'ACTIVE', weight: 1.0, self_healed: true}]->(newApi)
        RETURN f.id AS episode_id, oldApi.name AS old_name, newApi.name AS new_name
        """
        params = {
            "module_name": module_name,
            "failed_endpoint": failed_endpoint,
            "agent_name": agent_name,
            "ep_id": ep_id,
            "session_id": session_id,
            "error_message": error_message,
            "ts": ts,
            "replacement_endpoint": replacement_endpoint,
        }

        self.client.query(mutation_cypher, params=params, tenant_id=tenant_id)

        return {
            "status": "MUTATED",
            "episode_id": ep_id,
            "affected_nodes": [
                f"Failure({ep_id})",
                f"APIEndpoint({failed_endpoint})",
                f"APIEndpoint({replacement_endpoint})",
                f"CodeModule({module_name})",
            ],
            "affected_edges": [
                "EXECUTES_STEP (BLOCKED)",
                "DEPRECATES",
                "SUPERSEDED_BY",
                "EXECUTES_STEP (ACTIVE)",
            ],
            "summary": (
                f"Graph Stigmergy Mutation: Deprecated {failed_endpoint} following error; "
                f"self-healed {module_name} route to {replacement_endpoint}."
            ),
            "cypher_executed": mutation_cypher,
        }

    def trace_design_decision(
        self,
        module_name: str,
        tenant_id: str = "active_memory_default",
    ) -> Dict[str, Any]:
        """
        Execute the canonical 3-Hop Constraint Guardrail traversal:
        (CodeModule)-[:IMPLEMENTS]->(Decision)-[:FORCED_BY]->(JiraTicket)-[:EXPLAINED_IN]->(VCSComment)<-[:AUTHORED]-(Engineer)

        Returns complete context explaining why suboptimal patterns must be preserved.
        """
        cypher = """
        MATCH (m:CodeModule {name: $module_name})-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(v:VCSComment)<-[:AUTHORED]-(e:Engineer)
        OPTIONAL MATCH (g:Guardrail)-[:PROTECTS]->(m)
        RETURN d.id AS decision_id,
               d.status AS decision_status,
               d.summary AS decision_summary,
               d.title AS decision_title,
               d.rationale AS decision_rationale,
               j.id AS jira_id,
               j.summary AS jira_summary,
               j.status AS jira_status,
               v.id AS vcs_id,
               v.text AS vcs_text,
               v.pr_number AS pr_number,
               e.id AS engineer_id,
               e.name AS engineer_name,
               e.role AS engineer_role,
               e.email AS engineer_email,
               g.id AS guardrail_id,
               g.name AS guardrail_name,
               g.enforcement_level AS enforcement_level,
               [m.name, d.id, j.id, v.id, e.name] AS path_nodes
        """
        res = self.client.query(cypher, {"module_name": module_name}, tenant_id=tenant_id)
        if not res.records:
            return {
                "guardrail_active": False,
                "message": f"No constraint guardrails or decisions found for module '{module_name}'",
                "cypher_executed": cypher,
            }

        row = res.records[0]
        guardrail_active = (
            row.get("decision_status") == "SUBOPTIMAL_WORKAROUND"
            or bool(row.get("guardrail_id"))
        )

        return {
            "guardrail_active": guardrail_active,
            "decision": {
                "id": row.get("decision_id"),
                "status": row.get("decision_status"),
                "summary": row.get("decision_summary"),
                "title": row.get("decision_title"),
                "rationale": row.get("decision_rationale"),
            },
            "jira_ticket": {
                "id": row.get("jira_id"),
                "summary": row.get("jira_summary"),
                "status": row.get("jira_status"),
            },
            "vcs_comment": {
                "id": row.get("vcs_id"),
                "text": row.get("vcs_text"),
                "pr_number": row.get("pr_number"),
            },
            "engineer": {
                "id": row.get("engineer_id"),
                "name": row.get("engineer_name"),
                "role": row.get("engineer_role"),
                "email": row.get("engineer_email"),
            },
            "guardrail": {
                "id": row.get("guardrail_id"),
                "name": row.get("guardrail_name"),
                "enforcement_level": row.get("enforcement_level"),
            } if row.get("guardrail_id") else None,
            "path_nodes": row.get("path_nodes", []),
            "cypher_executed": cypher,
        }

    def find_domain_expert(
        self,
        module_name: str,
        tenant_id: str = "active_memory_default",
    ) -> Dict[str, Any]:
        """
        Identify the leading domain architect/expert for a code module based on
        graph centrality across ownership, authorship, and maintenance relationships.
        """
        cypher = """
        MATCH (m:CodeModule {name: $module_name})
        MATCH (eng:Engineer)-[r]-(item)
        WHERE (item = m)
           OR (item:Decision AND (m)-[:IMPLEMENTS]->(item))
           OR (item:JiraTicket AND (m)-[:IMPLEMENTS]->()-[:FORCED_BY]->(item))
           OR (item:VCSComment AND (m)-[:IMPLEMENTS]->()-[:FORCED_BY]->()-[:EXPLAINED_IN]->(item))
           OR (item:Service AND (item)-[:CONTAINS]->(m))
        RETURN eng.name AS expert_name,
               eng.role AS role,
               eng.email AS email,
               count(r) AS centrality_score,
               collect(DISTINCT type(r)) AS relations
        ORDER BY centrality_score DESC
        LIMIT 1
        """
        res = self.client.query(cypher, {"module_name": module_name}, tenant_id=tenant_id)
        if not res.records:
            return {
                "expert_name": None,
                "role": None,
                "email": None,
                "centrality_score": 0,
                "relations": [],
                "cypher_executed": cypher,
            }

        row = res.records[0]
        return {
            "expert_name": row.get("expert_name"),
            "role": row.get("role"),
            "email": row.get("email"),
            "centrality_score": row.get("centrality_score", 0),
            "relations": row.get("relations", []),
            "cypher_executed": cypher,
        }


# ==============================================================================
# FastMCP Tool Bindings
# ==============================================================================

@mcp.tool()
def get_procedural_route(module_name: str, tenant_id: str = "active_memory_default") -> Dict[str, Any]:
    """
    FastMCP Tool: Query FalkorDB to determine active operational route for a module.
    Automatically identifies self-healed routes if Graph Stigmergy has deprecated legacy endpoints.
    """
    controller = MemoryContextController()
    return controller.get_procedural_route(module_name=module_name, tenant_id=tenant_id)


@mcp.tool()
def log_failed_task(
    agent_name: str,
    session_id: str,
    module_name: str,
    failed_endpoint: str,
    error_message: str,
    replacement_endpoint: str,
    tenant_id: str = "active_memory_default",
) -> Dict[str, Any]:
    """
    FastMCP Tool: Record operational failure and atomically trigger Graph Stigmergy.
    Deprecates the failed route, creates failure provenance, and activates self-healed endpoint.
    """
    controller = MemoryContextController()
    return controller.log_failed_task(
        agent_name=agent_name,
        session_id=session_id,
        module_name=module_name,
        failed_endpoint=failed_endpoint,
        error_message=error_message,
        replacement_endpoint=replacement_endpoint,
        tenant_id=tenant_id,
    )


@mcp.tool()
def trace_design_decision(module_name: str, tenant_id: str = "active_memory_default") -> Dict[str, Any]:
    """
    FastMCP Tool: Execute 3-hop constraint guardrail traversal to retrieve governing ADR,
    incident root cause, Jira ticket, and authoring engineer rationale.
    """
    controller = MemoryContextController()
    return controller.trace_design_decision(module_name=module_name, tenant_id=tenant_id)


@mcp.tool()
def find_domain_expert(module_name: str, tenant_id: str = "active_memory_default") -> Dict[str, Any]:
    """
    FastMCP Tool: Perform graph centrality traversal to discover the authoritative engineer
    owning and maintaining the targeted module and its decisions.
    """
    controller = MemoryContextController()
    return controller.find_domain_expert(module_name=module_name, tenant_id=tenant_id)
