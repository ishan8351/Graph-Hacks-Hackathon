# Active Engineering Memory Layer — Project Plan

> **Project status:** Updated alongside the submission-readiness pass on 2026-10-18. The current implementation and checks below are authoritative; older audit notes have been removed where the code has since changed.

---

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 / Port 3001)                                   │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────────┐ │
│  │  TopNav   │  │  AgentFeed   │  │ GraphCanvas (React Flow)      │ │
│  └──────────┘  └──────────────┘  └────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐                           │
│  │  ExplainDecisionDrawer (slide-out)   │                           │
│  └──────────────────────────────────────┘                           │
├──────── SSE (EventSource) ──────────────────────────────────────────┤
│  Backend (FastAPI / Port 8000)                                       │
│  ┌──────────┐  ┌───────────────────┐  ┌──────────────────────────┐ │
│  │ REST API │  │ SSE Stream Bridge │  │ LangGraph Swarm Engine   │ │
│  └──────────┘  └───────────────────┘  └──────────────────────────┘ │
│  ┌──────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ FastMCP Tool Service │  │ FakeMicroserviceGateway (Mock HTTP)  │ │
│  └──────────────────────┘  └──────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│  FalkorDB (Port 6379 / Browser UI Port 3000)                        │
│  Multigraph Tenants: tenant_project_alpha, tenant_project_beta       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Feature Inventory — What Is Implemented ✅

### 2.1 Backend

| # | Feature | Files | Status |
|---|---------|-------|--------|
| 1 | **FalkorDB Multigraph Client** — tenant isolation, latency-tracked queries, topology extraction, safe `reset_graph()` | [graph_client.py](file:///home/cyber/Documents/Graph-Hacks-Hackathon/backend/app/db/graph_client.py) | ✅ Complete |
| 2 | **Enterprise Graph Seed Engine** — 44+ nodes (Services, Modules, Endpoints, Decisions, Jira, VCS, Engineers, Teams, Guardrails, Incidents), canonical 3-hop guardrail & self-healing topology, collaboration network | [seed_enterprise_graph.py](file:///home/cyber/Documents/Graph-Hacks-Hackathon/backend/app/db/seed_enterprise_graph.py) | ✅ Complete |
| 3 | **FastMCP Context Service** — `get_procedural_route()`, `log_failed_task()` (atomic stigmergy), `trace_design_decision()` (3-hop), `find_domain_expert()` (centrality) — both class-based and `@mcp.tool()` decorators | [memory_mcp.py](file:///home/cyber/Documents/Graph-Hacks-Hackathon/backend/app/mcp/memory_mcp.py) | ✅ Complete |
| 4 | **LangGraph Multi-Agent Swarm** — `StateGraph`, conditional routing, 3 scenario runners (A-S1, A-S2, B), event emission, `SwarmState` typed dict | [swarm.py](file:///home/cyber/Documents/Graph-Hacks-Hackathon/backend/app/agents/swarm.py) | ✅ Complete |
| 5 | **Fake Microservice Gateway** — deterministic mock for `/v1/legacy-auth` (410), `/v3/oauth/token` (200), `/v1/charge/sync` (200), `/v2/charge/batch` (502) | [fake_api_gateway.py](file:///home/cyber/Documents/Graph-Hacks-Hackathon/backend/app/services/fake_api_gateway.py) | ✅ Complete |
| 6 | **Pydantic SSE Event Models** — 5 typed events (`AGENT_STEP`, `MCP_TOOL_CALL`, `GRAPH_MUTATION`, `GUARDRAIL_TRIGGERED`, `SESSION_COMPLETE`), discriminated union, `parse_event()` | [events.py](file:///home/cyber/Documents/Graph-Hacks-Hackathon/backend/app/models/events.py) | ✅ Complete |
| 7 | **FastAPI REST + SSE Endpoints** — `/api/health`, `/api/graph/reset`, `/api/graph/state`, 3 SSE stream endpoints, `asyncio.Queue` bridge, CORS for ports 3000/3001 | [main.py](file:///home/cyber/Documents/Graph-Hacks-Hackathon/backend/app/main.py) | ✅ Complete |
| 8 | **1-Click Demo Script** — FalkorDB health check, graph seeding, concurrent backend + frontend launch, clean shutdown trap | [start_demo.sh](file:///home/cyber/Documents/Graph-Hacks-Hackathon/start_demo.sh) | ✅ Complete |

### 2.2 Frontend

| # | Feature | Files | Status |
|---|---------|-------|--------|
| 1 | **Dashboard Shell** — SSE `EventSource` lifecycle, graph state fetch, real-time event dispatch, mutation/guardrail reactivity | [Dashboard.tsx](file:///home/cyber/Documents/Graph-Hacks-Hackathon/frontend/src/components/Dashboard.tsx) | ✅ Complete |
| 2 | **TopNav** — Branding, tenant switcher, 4 action buttons (Reset, Act 1 S1, Act 1 S2, Act 2), FalkorDB status pill | [TopNav.tsx](file:///home/cyber/Documents/Graph-Hacks-Hackathon/frontend/src/components/TopNav.tsx) | ✅ Complete |
| 3 | **AgentFeed** — Renders all 5 SSE event types with distinct card styles, expandable Cypher viewer for MCP calls, "Explain Decision Path" button | [AgentFeed.tsx](file:///home/cyber/Documents/Graph-Hacks-Hackathon/frontend/src/components/AgentFeed.tsx) | ✅ Complete |
| 4 | **GraphCanvas** — Interactive React Flow canvas with relationship edges, pan/zoom, label filters, minimap, node inspector, deprecated indicators, and 3-hop highlight | [GraphCanvas.tsx](frontend/src/components/GraphCanvas.tsx) | ✅ Complete |
| 5 | **ExplainDecisionDrawer** — Slide-out with 3-hop chain viz, VCS warning blockquote, domain expert profile, Cypher query display, outcome banner | [ExplainDecisionDrawer.tsx](file:///home/cyber/Documents/Graph-Hacks-Hackathon/frontend/src/components/ExplainDecisionDrawer.tsx) | ✅ Complete |
| 6 | **TypeScript Event Types** — mirrors JSON Schema contract exactly | [events.ts](file:///home/cyber/Documents/Graph-Hacks-Hackathon/frontend/src/types/events.ts) | ✅ Complete |

### 2.3 Contracts & Testing

| # | Feature | Files | Status |
|---|---------|-------|--------|
| 1 | **JSON Schema Contract** — `events.schema.json` defining all 5 SSE event shapes | [events.schema.json](file:///home/cyber/Documents/Graph-Hacks-Hackathon/contracts/events.schema.json) | ✅ Complete |
| 2 | **FalkorDB Cypher Schema** — Full index/constraint spec, node definitions, relationship catalog, reference queries | [schema.cypher](file:///home/cyber/Documents/Graph-Hacks-Hackathon/contracts/schema.cypher) | ✅ Complete |
| 3 | **Backend Pytest Suite (35 tests)** — contracts, graph seed, MCP+fake API, LangGraph swarm, FastAPI SSE, E2E demo flow | [tests/](backend/tests) | ⚠️ Execution requires FalkorDB on port 6379 |
| 4 | **Frontend Vitest Suite (20 tests)** — contracts, Dashboard interactions, and Cypher playground | [__tests__/](frontend/src/__tests__), [test/](frontend/src/test) | ✅ Complete |

---

## 3. Submission Readiness

| Requirement | Project status |
|-------------|----------------|
| Public source repository | Git remote is configured as `https://github.com/ishan8351/Graph-Hacks-Hackathon`; public visibility still needs confirmation before submission. |
| README setup and graph model | Documented in `README.md`, including Docker Compose, manual local startup, synthetic node and relationship types, and seed/schema references. |
| Cypher queries or algorithms | Documented in `README.md` and `contracts/schema.cypher`; implementations live in `backend/app/mcp/memory_mcp.py`. |
| Live deployment or complete local setup | No hosted deployment is configured. Docker Compose and manual startup instructions are provided. |
| Demo video | Not present in the repository; record the working demo and add its public URL to `README.md` before submission. |
| Track and AI tool disclosure | Suggested tracks and Codex disclosure are recorded in `README.md`; confirm the selected tracks with the submission form. |

The UI now uses a light engineering change-dossier visual system: an activity ledger beside the relationship map, with restrained graph-label color and safety orange reserved for guardrails. It keeps both panels usable at desktop and phone widths, provides an explicit empty state, and keeps the action menu accessible. The graph currently uses a deterministic label-grouped layout with interactive React Flow edges; it is not a force-directed layout. See [frontend/DESIGN.md](frontend/DESIGN.md) for the interface decisions.

---

## 4. Prioritized Implementation Roadmap

### Phase 1: Core Visual Experience (P0) — *Implemented*

> **Goal:** Show FalkorDB nodes and relationships in an interactive, structured graph canvas.

- [x] **4.1** Implement `@xyflow/react` (React Flow) graph visualization in `GraphCanvas.tsx`
  - Deterministic label-grouped layout with custom node and edge renderers
  - Render all edges (relationships) with labeled arrows and styled relation chips
  - Color-code nodes by label type with custom palette and Lucide icons
  - Pan, zoom, drag support with custom fitView padding
  - Mini-map widget with tenant-aware color coding
  - When 3-hop guardrail triggers, highlight the traversal path with animated edges & pulse
- [x] **4.2** Add real-time node/edge insertion when `GRAPH_MUTATION` events arrive
  - New `Failure` nodes and routes reflect in real-time
  - `DEPRECATED` nodes visually dim with red border and `DEPRECATED` badge
  - New `SUPERSEDED_BY` and `FALLBACK_STEP` edges appear with dashed animation
- [x] **4.3** Wire node click events to the existing inspector panel with JSON attributes preview

### Phase 2: Polish & UX (P1) — *Demo Readiness*

- [x] **4.4** Add auto-scroll to `AgentFeed` with ref anchor so latest events are always visible
- [x] **4.5** Add loading skeleton overlay with dual-ring spin animation when graph state is being fetched
- [x] **4.6** Add SSE reconnection indicator (Live Stream / Connecting / Connected / Disconnected pill in TopNav)
- [x] **4.7** Create `.env.local` and `.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:8000`
- [x] **4.8** Create `docker-compose.yml` for full-stack orchestration (FalkorDB, Backend, Frontend)
- [x] **4.9** Add Dockerfiles for backend and frontend
- [x] **4.10** Add CI pipeline (`.github/workflows/ci.yml`) — lint, test, build

### Phase 3: Enhanced Features (P2) — *Differentiation*

- [x] **4.11** Add session history modal (`SessionHistoryModal.tsx`) — store past scenario runs in localStorage, replay events in feed
- [x] **4.12** Add Cypher query playground (`CypherPlaygroundModal.tsx`) with `/api/graph/query` endpoint and preset analytical queries
- [x] **4.13** Add MCP tool execution waterfall/timeline view with execution latency bar and Cypher statement preview
- [x] **4.14** Mobile responsive nav with collapsible hamburger action menu
- [x] **4.15** Seed `tenant_project_beta` with a distinct E-Commerce Logistics & Carrier Routing topology (OrderFulfillment, ADR-088, Kavita Rao)
- [x] **4.16** Add ESLint + Prettier config for frontend (`.eslintrc.json`, `.prettierrc`)
- [x] **4.17** Add `mypy` config and type stubs for backend in `pyproject.toml`

### Phase 4: Nice-to-Haves (P3) — *Polish*

- [x] **4.18** Engineering change-dossier visual system (paper surface, graphite ink, cobalt relationships, safety-orange guardrails)
- [x] **4.19** Keyboard shortcuts for scenario execution (`1` = Act 1 S1, `2` = Act 1 S2, `3` = Act 2, `R` = Reset, `Esc` = Close, `?` = Guide)
- [x] **4.20** Standalone API reference doc (`docs/API.md`)
- [x] **4.21** `next.config.mjs` production optimizations (compress, suppress power-by header, ignore build lint check)
- [x] **4.22** Add an Architecture & Shortcut guide modal inside the app (`ArchitectureGuideModal.tsx`)

---

## 5. File Map — Quick Reference

```
Graph-Hacks-Hackathon/
├── README.md                                    # Project overview & demo script
├── start_demo.sh                                # 1-click launcher
├── contracts/
│   ├── events.schema.json                       # SSE event JSON Schema contract
│   └── schema.cypher                            # FalkorDB Cypher schema + reference queries
├── backend/
│   ├── pyproject.toml                           # Python project metadata & deps
│   ├── requirements.txt                         # Pip requirements
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                              # FastAPI app (REST + SSE endpoints)
│   │   ├── agents/
│   │   │   ├── __init__.py
│   │   │   └── swarm.py                         # LangGraph multi-agent state machine
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── graph_client.py                  # FalkorDB multigraph client wrapper
│   │   │   └── seed_enterprise_graph.py         # Enterprise topology seed engine
│   │   ├── mcp/
│   │   │   ├── __init__.py
│   │   │   └── memory_mcp.py                    # FastMCP tools + MemoryContextController
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── events.py                        # Pydantic SSE event models
│   │   └── services/
│   │       ├── __init__.py
│   │       └── fake_api_gateway.py              # Deterministic mock gateway
│   └── tests/
│       ├── __init__.py
│       ├── test_contracts.py                    # Schema validation (9 tests)
│       ├── test_phase1_graph_seed.py            # Graph seeding (6 tests)
│       ├── test_phase2_fake_api_and_mcp.py      # MCP + Gateway (5 tests)
│       ├── test_phase3_langgraph_swarm.py       # Swarm execution (2 tests)
│       ├── test_phase4_fastapi_sse.py           # FastAPI SSE (4 tests)
│       └── test_e2e_demo_flow.py                # Full E2E (1 test)
└── frontend/
    ├── package.json                             # Next.js deps (React 19, @xyflow/react, lucide)
    ├── next.config.mjs
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── vitest.config.ts
    └── src/
        ├── app/
        │   ├── globals.css
        │   ├── layout.tsx
        │   └── page.tsx                         # Entry point → Dashboard
        ├── components/
        │   ├── Dashboard.tsx                    # Main shell (SSE + state management)
        │   ├── TopNav.tsx                       # Header bar with actions
        │   ├── AgentFeed.tsx                    # Left panel: live event stream
        │   ├── GraphCanvas.tsx                  # Right panel: node grid (⚠️ needs graph viz)
        │   └── ExplainDecisionDrawer.tsx        # Slide-out 3-hop explainer
        ├── types/
        │   └── events.ts                        # TS event type definitions
        ├── __tests__/
        │   └── Dashboard.test.tsx               # Dashboard component tests (5 tests)
        └── test/
            ├── setup.ts                         # Test setup
            └── contracts.test.ts                # Contract validation (6 tests)
```

---

## 6. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **FalkorDB over Neo4j** | Sub-millisecond Cypher traversals for real-time agent guardrails; Redis-compatible protocol; Cypher 9 support |
| **Deterministic swarm (no LLM calls)** | Hackathon demo reproducibility — every run produces identical event sequences |
| **SSE over WebSocket** | Simpler unidirectional streaming; native `EventSource` in browsers; no library needed |
| **Pydantic discriminated union** | O(1) polymorphic event parsing on `event_type` field |
| **TailwindCSS** | Rapid UI development with utility-first CSS (already configured) |
| **`@xyflow/react` chosen** | Installed in `package.json` but not yet wired — intended as the interactive graph engine |

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| FalkorDB not running → entire backend fails | High | `start_demo.sh` checks port 6379; add Docker Compose |
| SSE connection drops silently | Medium | Add reconnection logic + status indicator |
| Static card grid underwhelms judges | High | **Phase 1** implements real graph visualization |
| No CI → broken tests go unnoticed | Medium | **Phase 2** adds GitHub Actions |
| `@xyflow/react` version incompatibility with React 19 | Medium | Verify compatibility; pin version if needed |
