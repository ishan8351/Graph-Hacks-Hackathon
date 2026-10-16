# Active Engineering Memory Layer — API Reference Documentation

High-performance REST, Server-Sent Events (SSE), and FastMCP API specifications for the Active Engineering Memory Layer platform.

---

## 1. REST Endpoints

### 1.1 Health & FalkorDB Ping
- **Endpoint**: `GET /api/health`
- **Description**: Verifies backend availability and tests active connection to FalkorDB on port 6379.
- **Response**:
```json
{
  "status": "healthy",
  "falkordb": "connected",
  "host": "localhost",
  "port": 6379,
  "tenants": [
    "tenant_project_alpha",
    "tenant_project_beta",
    "active_memory_default"
  ]
}
```

---

### 1.2 Reset & Seed Graph
- **Endpoint**: `POST /api/graph/reset`
- **Description**: Resets target tenant graph namespace and deterministically populates enterprise socio-technical topology.
- **Request Body**:
```json
{
  "tenant_id": "tenant_project_alpha"
}
```
- **Supported Tenants**:
  - `tenant_project_alpha`: Enterprise Payments & Billing topology (44+ nodes, ADR-019, Aarav, PaymentRetryWorker).
  - `tenant_project_beta`: E-Commerce Logistics & Carrier Routing topology (OrderFulfillment, ADR-088, Kavita Rao).
- **Response**:
```json
{
  "status": "SUCCESS",
  "tenant_id": "tenant_project_alpha",
  "node_count": 44,
  "edge_count": 82,
  "nodes": [...],
  "links": [...]
}
```

---

### 1.3 Live Graph Topology State
- **Endpoint**: `GET /api/graph/state`
- **Query Parameters**:
  - `tenant_id` (string, default: `tenant_project_alpha`)
- **Description**: Retrieves full live graph topology (nodes and links) with computed operational statistics.
- **Response**:
```json
{
  "tenant_id": "tenant_project_alpha",
  "nodes": [
    {
      "id": "PaymentRetryWorker",
      "label": "CodeModule",
      "labels": ["CodeModule"],
      "properties": {
        "name": "PaymentRetryWorker",
        "file_path": "billing/workers/retry.py"
      }
    }
  ],
  "links": [
    {
      "id": "rel_0",
      "source": "PaymentRetryWorker",
      "target": "dec_19",
      "type": "IMPLEMENTS",
      "properties": {}
    }
  ],
  "stats": {
    "active_endpoints": 6,
    "deprecated_endpoints": 1,
    "logged_episodes": 0,
    "total_nodes": 44,
    "total_links": 82
  }
}
```

---

### 1.4 Cypher Query Playground
- **Endpoint**: `POST /api/graph/query`
- **Description**: Executes arbitrary OpenCypher queries against the specified tenant in FalkorDB with sub-millisecond execution reporting.
- **Request Body**:
```json
{
  "tenant_id": "tenant_project_alpha",
  "query": "MATCH (eng:Engineer) RETURN eng.name AS name, eng.role AS role"
}
```
- **Response**:
```json
{
  "status": "SUCCESS",
  "tenant_id": "tenant_project_alpha",
  "query": "MATCH (eng:Engineer) RETURN eng.name AS name, eng.role AS role",
  "columns": ["name", "role"],
  "records": [
    {
      "name": "Aarav",
      "role": "Staff Systems Architect"
    }
  ],
  "latency_ms": 0.85,
  "count": 4
}
```

---

## 2. Server-Sent Events (SSE) Streaming Endpoints

All SSE endpoints stream structured JSON events matching the JSON Schema contract defined in `/contracts/events.schema.json`.

Headers returned:
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### 2.1 Act 1: Session 1 (HTTP 410 -> Graph Stigmergy)
- **Endpoint**: `GET /api/stream/scenario-a/session-1?tenant_id={tenant_id}`
- **Scenario Narrative**: `IngestionSubagent` attempts to invoke `/v1/legacy-auth`, receives HTTP 410 Gone, triggers atomic Graph Stigmergy mutation (`Failure` node logged, `/v1/legacy-auth` set to `DEPRECATED`), and heals execution route to `/v3/oauth/token`.
- **Emitted Event Sequence**:
  1. `AGENT_STEP` (IngestionSubagent begins execution)
  2. `MCP_TOOL_CALL` (`get_procedural_route` for TokenIngestionWorker)
  3. `AGENT_STEP` (Subagent receives HTTP 410)
  4. `MCP_TOOL_CALL` (`log_failed_task` atomic stigmergy)
  5. `GRAPH_MUTATION` (FalkorDB mutation applied: `DEPRECATES`, `SUPERSEDED_BY`)
  6. `MCP_TOOL_CALL` (`get_procedural_route` queries healed route)
  7. `AGENT_STEP` (Subagent successfully authenticates via `/v3/oauth/token`)
  8. `SESSION_COMPLETE` (status: `SUCCESS`)

---

### 2.2 Act 1: Session 2 (Zero-Shot Self-Healing Route)
- **Endpoint**: `GET /api/stream/scenario-a/session-2?tenant_id={tenant_id}`
- **Scenario Narrative**: `BillingSubagent` starts in a clean session with zero conversational memory. By querying FalkorDB via FastMCP, it immediately discovers the `DEPRECATED` status and `SUPERSEDED_BY` relationship established by Session 1, achieving **zero-shot route resolution**.
- **Emitted Event Sequence**:
  1. `AGENT_STEP` (BillingSubagent initialized)
  2. `MCP_TOOL_CALL` (`get_procedural_route`)
  3. `AGENT_STEP` (Routes directly to `/v3/oauth/token` without hitting 410)
  4. `SESSION_COMPLETE` (status: `SUCCESS`)

---

### 2.3 Act 2: 3-Hop Constraint Guardrail
- **Endpoint**: `GET /api/stream/scenario-b/guardrail?tenant_id={tenant_id}`
- **Scenario Narrative**: `RefactoringArchitectAgent` is asked to batch-refactor `PaymentRetryWorker`. Before modifying code, it executes a 3-hop traversal:
  ```
  (PaymentRetryWorker)-[:IMPLEMENTS]->(dec_19:Decision)
  -[:FORCED_BY]->(PAY-409:JiraTicket)
  -[:EXPLAINED_IN]->(pr_882_c4:VCSComment)
  <-[:AUTHORED]-(Aarav:Engineer)
  ```
  Encountering Aarav's warning that partner banks drop batched webhooks, the Active Memory Layer fires `GUARDRAIL_TRIGGERED` and halts the destructive refactor.
- **Emitted Event Sequence**:
  1. `AGENT_STEP` (Architect inspects dependencies)
  2. `MCP_TOOL_CALL` (`trace_design_decision` 3-hop path query)
  3. `GUARDRAIL_TRIGGERED` (Invariant violation detected, full 5-node path returned)
  4. `SESSION_COMPLETE` (status: `BLOCKED_BY_GUARDRAIL`)

---

## 3. FastMCP Tools Specification

| Tool Name | Parameters | Cypher Traversal | Purpose |
|-----------|------------|------------------|---------|
| `get_procedural_route` | `module_name: str` | `MATCH (m:CodeModule {name: $name})-[r:EXECUTES_STEP]->(api:APIEndpoint) RETURN api.name, api.status, api.is_deprecated` | Returns active route or healed fallback route |
| `log_failed_task` | `module_name: str, failed_endpoint: str, replacement_endpoint: str` | `CREATE (f:Failure {status_code: 410}) MERGE (m)-[:LOGGED_EPISODE]->(f) SET ep1.status = 'DEPRECATED' MERGE (ep1)-[:SUPERSEDED_BY]->(ep2)` | Atomic stigmergy writing failure provenance into the graph |
| `trace_design_decision` | `module_name: str` | `MATCH path = (m:CodeModule {name: $name})-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(c:VCSComment)<-[:AUTHORED]-(eng:Engineer) RETURN path` | Traverses the canonical 3-hop invariant path |
| `find_domain_expert` | `domain_tag: str` | `MATCH (eng:Engineer)-[r]->(target) WHERE eng.domain = $domain RETURN eng.name, count(r) AS degree ORDER BY degree DESC LIMIT 1` | Identifies primary domain architect via degree centrality |

---

## 4. SSE Event Schema Summary

```typescript
type MemoryLayerEvent =
  | AgentStepEvent
  | McpToolCallEvent
  | GraphMutationEvent
  | GuardrailTriggeredEvent
  | SessionCompleteEvent;
```

Each event payload contains:
- `event_id`: Unique UUIDv4 string
- `timestamp`: ISO-8601 UTC timestamp
- `session_id`: Unique session identifier string
- `event_type`: Discriminated union key
