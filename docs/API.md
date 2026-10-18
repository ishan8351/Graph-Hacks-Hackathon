# Active Engineering Memory Layer: API reference

REST, Server-Sent Events (SSE), and FastMCP endpoints for the Active Engineering Memory Layer.

## 1. REST endpoints

### 1.1 Health check and FalkorDB ping

`GET /api/health`

Verifies backend availability and tests the active connection to FalkorDB on port 6379.

Response:
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

### 1.2 Reset and seed graph

`POST /api/graph/reset`

Clears the target tenant graph namespace and populates it with synthetic services, code modules, decisions, Jira tickets, and comments.

Request body:
```json
{
  "tenant_id": "tenant_project_alpha"
}
```

Supported tenants:
- `tenant_project_alpha`: Payments and billing topology (44+ nodes, ADR-019, Aarav, PaymentRetryWorker).
- `tenant_project_beta`: Logistics and carrier routing topology (OrderFulfillment, ADR-088, Kavita Rao).

Response:
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

### 1.3 Live graph topology state

`GET /api/graph/state`

Query parameters:
- `tenant_id` (string, default: `tenant_project_alpha`)

Returns the current graph topology (nodes and links) along with operational counts.

Response:
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

### 1.4 Cypher query playground

`POST /api/graph/query`

Runs an OpenCypher query against the specified tenant in FalkorDB and returns records with execution latency in milliseconds.

Request body:
```json
{
  "tenant_id": "tenant_project_alpha",
  "query": "MATCH (eng:Engineer) RETURN eng.name AS name, eng.role AS role"
}
```

Response:
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

### 1.5 Persistent agent memory

`POST /api/memory/records` stores `EPISODIC`, `SEMANTIC`, or `PROCEDURAL` records in the tenant graph. Supply an `idempotency_key` that is stable for the logical write; retrying that key updates the existing record. Optional `conversation_id` and `session_id` fields make history retrievable across process and browser sessions.

```json
{
  "tenant_id": "tenant_project_alpha",
  "user_id": "demo_user",
  "memory_type": "SEMANTIC",
  "content": "The partner gateway drops webhooks when batch size exceeds one.",
  "agent_id": "architect-agent",
  "idempotency_key": "payment-batch-invariant-v1",
  "source_id": "PAY-409",
  "confidence": 0.98
}
```

`GET /api/memory/records?tenant_id=...&user_id=...&memory_type=...` recalls recent records. `GET /api/memory/conversations/{conversation_id}` returns episodic turns oldest-first.

### 1.6 Shared agent handoffs

`POST /api/memory/handoffs` creates an idempotent handoff with task, recipient, and JSON payload. `GET /api/memory/handoffs` lists the current user's handoffs. `PATCH /api/memory/handoffs/{id}` requires `expected_version`; stale concurrent updates return `409 Conflict` rather than overwriting newer state.

### 1.7 Company source ingestion and cited answers

`POST /api/company/sources` upserts a `DOCUMENT`, `TICKET`, or `CHAT` source by stable source ID, its content and locator, connected entities, and typed relationships. Re-ingesting the same source ID updates its record and mention links.

`POST /api/company/ask` searches the selected tenant graph, expands matched entities through connected nodes, and returns evidence paths and source citations. With `GEMINI_API_KEY` configured, Gemini receives only the retrieved excerpts and produces a concise answer with source IDs; without a key (or when Gemini is unavailable), the endpoint falls back to deterministic graph retrieval. The response includes `answer_mode` (`gemini` or `graph`) and an optional `llm_note`.

```json
{
  "tenant_id": "tenant_project_alpha",
  "question": "Who owns PaymentRetryWorker, and why is batching unsafe?"
}
```

`GET /api/stream/agent-handoff?tenant_id=...&user_id=...&question=...` runs `ContextAgent` and `ResearchAgent` as sequential LangGraph nodes. The first agent retrieves graph evidence, writes an episodic record, and creates a versioned handoff. The second agent reloads and claims that handoff, recalls the linked episode, then completes the handoff with its resumed answer and citations. Each step streams as `AGENT_STEP` or `MCP_TOOL_CALL`; the run ends with `SESSION_COMPLETE`.

Local `.txt`, `.md`, `.json`, and `.csv` files can be imported from the Company Brain UI. The browser reads the file and sends normalized source records to `POST /api/company/sources`; no Slack, GitHub, cloud drive, ticketing API, or other connector is included. JSON arrays (or a `{ "records": [...] }` object) and CSV headers such as `id,title,type,content,url` are supported. Local PDF extraction and cloud document-store synchronization are not included.

Memory and source endpoints default `user_id` to `demo_user` for local demonstrations. Caller-provided user IDs are scoping keys, not authentication; deploy behind an authenticated identity layer before treating them as access control.

## 2. Server-Sent Events (SSE) streaming endpoints

All SSE endpoints stream JSON events following the contract in `/contracts/events.schema.json`.
Each completed run also writes one idempotent `EPISODIC` memory record for the supplied `user_id` (default `demo_user`) in the selected tenant graph.

Headers returned:
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### 2.1 Act 1, session 1: HTTP 410 and stigmergy

`GET /api/stream/scenario-a/session-1?tenant_id={tenant_id}`

`IngestionSubagent` calls `/v1/legacy-auth`, receives HTTP 410 Gone, records the failure in the graph, marks `/v1/legacy-auth` as `DEPRECATED`, and points the route to `/v3/oauth/token`.

Event sequence:
1. `AGENT_STEP` (IngestionSubagent starts)
2. `MCP_TOOL_CALL` (`get_procedural_route` for TokenIngestionWorker)
3. `AGENT_STEP` (Subagent receives HTTP 410)
4. `MCP_TOOL_CALL` (`log_failed_task` records failure and updates route)
5. `GRAPH_MUTATION` (FalkorDB updates `DEPRECATES` and `SUPERSEDED_BY`)
6. `MCP_TOOL_CALL` (`get_procedural_route` queries updated route)
7. `AGENT_STEP` (Subagent authenticates via `/v3/oauth/token`)
8. `SESSION_COMPLETE` (status: `SUCCESS`)

### 2.2 Act 1, session 2: route reuse without retesting

`GET /api/stream/scenario-a/session-2?tenant_id={tenant_id}`

`BillingSubagent` starts in a new session with no prior conversation state. It queries FalkorDB through FastMCP, finds the `DEPRECATED` flag and `SUPERSEDED_BY` link from Session 1, and routes straight to `/v3/oauth/token`.

Event sequence:
1. `AGENT_STEP` (BillingSubagent initialized)
2. `MCP_TOOL_CALL` (`get_procedural_route`)
3. `AGENT_STEP` (Routes directly to `/v3/oauth/token` without hitting 410)
4. `SESSION_COMPLETE` (status: `SUCCESS`)

### 2.3 Act 2: 3-hop constraint guardrail

`GET /api/stream/scenario-b/guardrail?tenant_id={tenant_id}`

`ArchitectAgent` is instructed to refactor `PaymentRetryWorker` to batch charges. Before changing code, it checks dependencies across 3 hops:
```
(PaymentRetryWorker)-[:IMPLEMENTS]->(dec_19:Decision)
-[:FORCED_BY]->(PAY-409:JiraTicket)
-[:EXPLAINED_IN]->(pr_882_c4:VCSComment)
<-[:AUTHORED]-(Aarav:Engineer)
```
Finding Aarav's warning that partner banks drop batched webhooks, the system emits `GUARDRAIL_TRIGGERED` and stops the refactor.

Event sequence:
1. `AGENT_STEP` (Architect inspects dependencies)
2. `MCP_TOOL_CALL` (`trace_design_decision` 3-hop query)
3. `GUARDRAIL_TRIGGERED` (Constraint matched, 5-node path returned)
4. `SESSION_COMPLETE` (status: `BLOCKED_BY_GUARDRAIL`)

## 3. FastMCP tools

| Tool name | Parameters | Cypher query | Purpose |
| :--- | :--- | :--- | :--- |
| `get_procedural_route` | `module_name: str` | `MATCH (m:CodeModule {name: $name})-[r:EXECUTES_STEP]->(api:APIEndpoint) RETURN api.name, api.status, api.is_deprecated` | Returns active or replacement endpoint |
| `log_failed_task` | `module_name: str, failed_endpoint: str, replacement_endpoint: str` | `CREATE (f:Failure {status_code: 410}) MERGE (m)-[:LOGGED_EPISODE]->(f) SET ep1.status = 'DEPRECATED' MERGE (ep1)-[:SUPERSEDED_BY]->(ep2)` | Writes failure record and updates route in graph |
| `trace_design_decision` | `module_name: str` | `MATCH path = (m:CodeModule {name: $name})-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(c:VCSComment)<-[:AUTHORED]-(eng:Engineer) RETURN path` | Checks 3-hop constraint path |
| `find_domain_expert` | `domain_tag: str` | `MATCH (eng:Engineer)-[r]->(target) WHERE eng.domain = $domain RETURN eng.name, count(r) AS degree ORDER BY degree DESC LIMIT 1` | Finds module architect by relationship count |

## 4. SSE event schema

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
