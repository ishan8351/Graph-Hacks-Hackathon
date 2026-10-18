# Active Engineering Memory Layer
### *Turning Passive Engineering Knowledge into Active Graph Guardrails & Self-Healing Procedural Memory*

[![FalkorDB](https://img.shields.io/badge/FalkorDB-Cypher%209-red?style=flat-square&logo=redis)](https://falkordb.com)
[![FastMCP](https://img.shields.io/badge/FastMCP-Model%20Context%20Protocol-blue?style=flat-square)](https://modelcontextprotocol.io)
[![LangGraph](https://img.shields.io/badge/LangGraph-Multi--Agent%20Swarm-purple?style=flat-square)](https://langchain.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-SSE%20Streaming-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js 15](https://img.shields.io/badge/Next.js%2015-App%20Router-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Automated Tests](https://img.shields.io/badge/tests-backend%20%2B%20frontend-blue?style=flat-square)](backend/tests)

---

## 💡 Executive Pitch & Vision

Autonomous coding agents (e.g. Claude Code, Cursor, Devin) are rapidly taking over software refactoring and operational engineering tasks. However, when an AI agent enters a complex enterprise codebase, **it suffers from acute architectural amnesia**:
- Architecture Decision Records (ADRs) are buried in stale Markdown files.
- Incident postmortems are siloed in closed Jira tickets.
- Subtle production invariants are hidden inside PR code review comments.

Standard **Vector RAG catastrophically fails** here. Searching embeddings for *"optimize retry loop"* retrieves textbook advice urging *"upgrade to batch endpoints for 10x throughput"* — oblivious to the fact that our partner bank gateway silently drops webhooks if batched > 1.

**Active Engineering Memory Layer** transforms enterprise engineering history into an **Active Socio-Technical Graph** in **FalkorDB**. When an agent acts, deterministic **FastMCP** tools traverse multi-hop graph invariants in sub-milliseconds to:
1. **Halt Destructive Regressions:** Actively block unsafe AI refactors using 3-hop constraint paths (`CodeModule -> Decision -> JiraTicket -> VCSComment <- Engineer`).
2. **Execute Biological Graph Stigmergy:** When an operational error occurs (e.g. HTTP 410 on deprecated APIs), the agent leaves a *digital pheromone* directly in the graph. Peer agents and future sessions self-heal zero-shot without repeating errors.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Frontend["Frontend Client (Port 3001)"]
        UI["Next.js 15 Split-Screen UI"]
        Feed["Live Multi-Agent SSE Feed"]
        Canvas["Interactive FalkorDB Canvas"]
        Drawer["Explain Decision Path Drawer"]
        UI --> Feed
        UI --> Canvas
        UI --> Drawer
    end

    subgraph Backend["FastAPI SSE Bridge (Port 8000)"]
        API["REST & SSE Endpoints"]
        SSEQueue["Async Event Queue (sse-starlette)"]
        API --> SSEQueue
    end

    subgraph Swarm["LangGraph Multi-Agent Swarm"]
        Orch["LangGraph StateMachine"]
        Sub1["IngestionSubagent"]
        Sub2["BillingSubagent"]
        Sub3["ArchitectAgent"]
        Orch --> Sub1
        Orch --> Sub2
        Orch --> Sub3
    end

    subgraph MCP["Deterministic FastMCP Context Service"]
        T1["get_procedural_route()"]
        T2["log_failed_task() (Stigmergy)"]
        T3["trace_design_decision() (3-Hop)"]
        T4["find_domain_expert() (Centrality)"]
    end

    subgraph Storage["Graph Engine (Port 6379 / UI 3000)"]
        Falkor["FalkorDB (Cypher 9)"]
        Alpha["tenant_project_alpha"]
        Beta["tenant_project_beta"]
        Falkor --> Alpha
        Falkor --> Beta
    end

    subgraph Gateways["Deterministic Custom Gateways"]
        MockGW["FakeMicroserviceGateway\n(410 Gone / 502 Webhook Drop)"]
    end

    UI -- "SSE Events Stream" --> API
    API -- "Dispatches Scenarios" --> Swarm
    Swarm -- "FastMCP Invocations" --> MCP
    MCP -- "Sub-ms Cypher Traversals" --> Falkor
    Swarm -- "Deterministic Calls" --> MockGW
```

---

## 🧬 Biological Graph Stigmergy & Self-Healing

In biology, ants coordinate complex colony behavior without central coordination by depositing pheromones on trails (**stigmergy**).

In our system, when `IngestionSubagent` hits an operational `HTTP 410 Gone` on `/v1/legacy-auth`:
1. It does not crash or silently fail.
2. It executes an atomic Cypher mutation in FalkorDB:
   - Deprecates the old endpoint and sets the step status to `BLOCKED`.
   - Pins a `(Failure)` episode node to the graph.
   - Creates a `[:DEPRECATES]` relationship with weight `0.0`.
   - Establishes a `[:SUPERSEDED_BY]` edge pointing to the recommended `/v3/oauth/token`.
   - Promotes a new active `[:EXECUTES_STEP {self_healed: true}]` edge.
3. In **Session 2**, a completely independent `BillingSubagent` queries the procedural route and instantly receives `/v3/oauth/token` zero-shot with zero trial-and-error!

---

## ⚡ Core Cypher Queries (Sub-Millisecond FastMCP Tools)

### 1. 3-Hop Constraint Guardrail Traversal (`trace_design_decision`)
```cypher
MATCH (m:CodeModule {name: $module_name})-[:IMPLEMENTS]->(d:Decision)-[:FORCED_BY]->(j:JiraTicket)-[:EXPLAINED_IN]->(v:VCSComment)<-[:AUTHORED]-(e:Engineer)
OPTIONAL MATCH (g:Guardrail)-[:PROTECTS]->(m)
RETURN d.id AS decision_id,
       d.status AS decision_status,
       d.summary AS decision_summary,
       j.id AS jira_id,
       v.id AS vcs_id,
       v.text AS vcs_text,
       e.name AS engineer_owner,
       e.role AS engineer_role,
       [m.name, d.id, j.id, v.id, e.name] AS path_nodes;
```
> **Latency:** ~0.15ms in FalkorDB. Evaluates whether a module has active `SUBOPTIMAL_WORKAROUND` invariants before any code change is attempted.

### 2. Atomic Graph Stigmergy Mutation (`log_failed_task`)
```cypher
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
RETURN f.id AS episode_id;
```
> **Latency:** ~0.25ms in FalkorDB. Atomically records failure episodes and heals execution routes.

### 3. Domain Expert Graph Centrality (`find_domain_expert`)
```cypher
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
LIMIT 1;
```
> **Result:** Identifies `Aarav` (Staff Systems Architect) with centrality score 5 (`['OWNS', 'MAINTAINS', 'AUTHORED', 'RESOLVED']`).

---

## 🎬 2-Minute Winning Demo Script

### **Act 1: Cross-Session Stigmergic Learning**
1. **Click "Run Act 1: Session 1 (Hit 410 & Write Stigmergy)"**:
   - `IngestionSubagent` inspects `TokenIngestionWorker` and calls `/v1/legacy-auth`.
   - The fake gateway returns `HTTP 410 Gone: Endpoint /v1/legacy-auth is discontinued. Migrate to /v3/oauth/token`.
   - The agent triggers MCP `log_failed_task`.
   - **Visual feedback:** A neon cyan `GRAPH_MUTATION` card appears in the feed, `/v1/legacy-auth` badge switches to red `DEPRECATED`, and the agent retries on `/v3/oauth/token` with 200 OK.
2. **Click "Run Act 1: Session 2 (Zero-Shot Self-Healing Route)"**:
   - `BillingSubagent` starts in a **brand new session**.
   - It queries FalkorDB for the active route: the graph immediately routes it to `/v3/oauth/token` citing Session 1's failure provenance.
   - **Result:** Executes in **< 10ms zero-shot** without repeating the 410 error!

### **Act 2: 3-Hop Constraint Guardrail Halts Destructive Refactor**
1. **Click "Run Act 2: Refactor PaymentRetryWorker (3-Hop Guardrail)"**:
   - User asks the agent: *"Optimize the slow 450ms synchronous polling loop in PaymentRetryWorker by upgrading to /v2/charge/batch."*
   - `ArchitectAgent` executes `trace_design_decision("PaymentRetryWorker")`.
   - FalkorDB traverses 3 hops:
     - `PaymentRetryWorker` &rarr; `dec_19` (status: `SUBOPTIMAL_WORKAROUND`)
     - `dec_19` &rarr; `PAY-409` (incident postmortem)
     - `PAY-409` &rarr; `pr_882_c4` (VCS comment) &larr; `Aarav` (Staff Architect)
   - **Visual feedback:** The **"Explain Decision Path"** slide-out drawer automatically expands, revealing:
     - The 3-hop invariant chain.
     - Aarav's warning: *"DO NOT upgrade to /v2/charge/batch here! Legacy partner bank gateway drops webhooks if batched > 1."*
     - The exact Cypher traversal and high centrality profile.
   - **Outcome:** The agent safely **aborts** the refactor, preserving the synchronous charge loop and preventing an outage!

---

## 🚀 Quickstart & Setup Guide

### Port Allocation
- **FalkorDB Database:** `localhost:6379`
- **FalkorDB Browser UI:** `localhost:3000`
- **FastAPI Backend (SSE):** `localhost:8000`
- **Next.js Web Application:** `localhost:3001`

### Option 1: 1-Click Launch (Recommended)
```bash
# One-time setup
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm ci && cd ..

# Start FalkorDB separately (Docker/Podman), then launch the app
docker run -p 6379:6379 -p 3000:3000 -d --name falkordb falkordb/falkordb:latest
./start_demo.sh
```
The launcher verifies FalkorDB on port 6379, seeds both tenant graphs, and starts FastAPI and Next.js. Open **http://localhost:3001**. The first screen load also offers **Reset & Seed Graph** for the selected tenant.

### Option 2: Docker Compose
```bash
docker compose up --build
```
Open **http://localhost:3001** and choose **Reset & Seed Graph**. The compose stack exposes FalkorDB on `6379`, its browser UI on `3000`, FastAPI on `8000`, and Next.js on `3001`.

### Option 3: Manual Start

#### 1. Start FalkorDB (if not already running)
```bash
docker run -p 6379:6379 -p 3000:3000 -d --name falkordb falkordb/falkordb:latest
```

#### 2. Start Backend
```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend && .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### 3. Start Frontend
```bash
cd frontend
npm ci
npm run dev -- -p 3001
```

Visit **http://localhost:3001** to view the application.

---

## 🧪 Comprehensive Automated Test Verification

Run the frontend checks from the repository's `frontend/` directory. Backend API and end-to-end tests require a reachable FalkorDB instance on port 6379.

### Backend Pytest Suite (35 Tests)
```bash
backend/.venv/bin/pytest -v backend/tests
```
- `backend/tests/test_contracts.py` (10 tests)
- `backend/tests/test_phase1_graph_seed.py` (6 tests)
- `backend/tests/test_phase2_fake_api_and_mcp.py` (5 tests)
- `backend/tests/test_phase3_langgraph_swarm.py` (6 tests)
- `backend/tests/test_phase4_fastapi_sse.py` (7 tests)
- `backend/tests/test_e2e_demo_flow.py` (1 test)
**Total: 35 tests**

### Frontend Vitest Suite (20 Tests)
```bash
cd frontend && npm test
```
- `contracts.test.ts` (6 passed)
- `CypherPlaygroundModal.test.tsx` (3 passed)
- `Dashboard.test.tsx` (11 passed)
**Total: 20 passed**

### Production Build
```bash
cd frontend && npm run build
```
The optimized Next.js production build completes successfully.

---

## Graph Hacks Submission Details

- **Source repository:** [github.com/ishan8351/Graph-Hacks-Hackathon](https://github.com/ishan8351/Graph-Hacks-Hackathon) (the repository must be public when submitted).
- **Tracks:** Agent Memory and Coordination; Agents That Act on Connected Data.
- **Graph data model:** Each tenant is an isolated FalkorDB graph. Nodes model synthetic `Service`, `CodeModule`, `APIEndpoint`, `Decision`, `JiraTicket`, `VCSComment`, `Engineer`, `Team`, `Guardrail`, `Incident`, `Agent`, and `Failure` records. Typed relationships such as `IMPLEMENTS`, `FORCED_BY`, `EXPLAINED_IN`, `AUTHORED`, `PROTECTS`, `EXECUTES_STEP`, `SUPERSEDED_BY`, and `LOGGED_EPISODE` carry the decision provenance, operational routes, and learned failure history. The data is synthetic and seeded by [seed_enterprise_graph.py](backend/app/db/seed_enterprise_graph.py); indexes and reference queries are in [schema.cypher](contracts/schema.cypher).
- **Core Cypher and graph algorithms:** The product depends on multi-hop decision tracing, graph-based expert ranking, and an atomic failure-to-route mutation. See the examples above and the implementation in [memory_mcp.py](backend/app/mcp/memory_mcp.py). The runnable schema and queries are in [contracts/schema.cypher](contracts/schema.cypher).
- **Local setup:** The Docker Compose and manual setup instructions above are the complete local run path; a public live deployment is not configured in this repository.
- **Demo video:** Record the working project and add the public video URL here before submitting. The two-session self-healing demo and the guardrail demo are described above.
- **AI coding assistant disclosure:** OpenAI Codex was used to review and modify the UI and submission documentation. The project team should review the changes and be ready to explain its graph model, Cypher, architecture, and implementation decisions.
