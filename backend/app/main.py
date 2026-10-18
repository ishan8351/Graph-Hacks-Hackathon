"""
Active Engineering Memory Layer - FastAPI Main Application & SSE Streaming Bridge
==================================================================================
Exposes high-performance REST and Server-Sent Events (SSE) streaming endpoints:
1. Multi-Tenant Graph State Management:
   - GET /api/health: Live health check & FalkorDB ping
   - POST /api/graph/reset: Deterministic enterprise synthetic topology seeding
   - GET /api/graph/state: Real-time graph nodes, links, and health statistics
2. Real-Time SSE Multi-Agent Swarm Streams:
   - GET /api/stream/scenario-a/session-1: IngestionSubagent 410 -> Graph Stigmergy stream
   - GET /api/stream/scenario-a/session-2: BillingSubagent zero-shot resolution stream
   - GET /api/stream/scenario-b/guardrail: 3-Hop Constraint Guardrail abort stream
"""

import asyncio
import logging
import os
from pathlib import Path
import sys
from typing import Any, Callable, Dict, List, Literal, Optional

# Ensure backend root directory is in sys.path
backend_dir = str(Path(__file__).resolve().parents[1])
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logger = logging.getLogger(__name__)
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

import uuid
from app.agents.swarm import (
    run_agent_handoff_workflow,
    run_scenario_a_session_1,
    run_scenario_a_session_2,
    run_scenario_b_refactor_guardrail,
)
from app.db.graph_client import FalkorDBClient
from app.db.seed_enterprise_graph import seed_tenant_graph
from app.models.events import SessionCompleteEvent, SessionStatus
from app.services.agent_memory import AgentMemoryService

# Initialize FastAPI application
app = FastAPI(
    title="Active Engineering Memory Layer API",
    description="Socio-technical knowledge graph memory, FastMCP tools, and LangGraph multi-agent swarm SSE stream.",
    version="1.0.0",
)

# Configure CORS for local development and cloud deployments (e.g. Vercel)
cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if cors_origins_env:
    for o in cors_origins_env.split(","):
        stripped = o.strip()
        if stripped and stripped not in allowed_origins:
            allowed_origins.append(stripped)

is_wildcard = cors_origins_env.strip() == "*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else allowed_origins,
    allow_origin_regex=None if is_wildcard else os.getenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app"),
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared FalkorDB multigraph client instance
db_client = FalkorDBClient()


class ResetGraphRequest(BaseModel):
    tenant_id: str = Field(
        default="tenant_project_alpha",
        description="Graph tenant namespace to reset and seed.",
    )


class GraphQueryRequest(BaseModel):
    query: str = Field(..., description="OpenCypher query to execute against FalkorDB.")
    tenant_id: str = Field(
        default="tenant_project_alpha",
        description="Target tenant graph namespace.",
    )


class MemoryWriteRequest(BaseModel):
    tenant_id: str = Field(default="tenant_project_alpha", min_length=1, max_length=128)
    user_id: str = Field(default="demo_user", min_length=1, max_length=128)
    memory_type: Literal["EPISODIC", "SEMANTIC", "PROCEDURAL"]
    content: str = Field(..., min_length=1, max_length=12000)
    agent_id: str = Field(default="human", min_length=1, max_length=128)
    idempotency_key: str = Field(..., min_length=1, max_length=256)
    summary: Optional[str] = Field(default=None, max_length=2000)
    session_id: Optional[str] = None
    conversation_id: Optional[str] = None
    source_id: Optional[str] = None
    confidence: float = Field(default=1.0, ge=0, le=1)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HandoffCreateRequest(BaseModel):
    tenant_id: str = Field(default="tenant_project_alpha", min_length=1, max_length=128)
    user_id: str = Field(default="demo_user", min_length=1, max_length=128)
    from_agent: str = Field(..., min_length=1, max_length=128)
    to_agent: str = Field(..., min_length=1, max_length=128)
    task: str = Field(..., min_length=1, max_length=4000)
    payload: Dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field(..., min_length=1, max_length=256)


class HandoffUpdateRequest(BaseModel):
    tenant_id: str = Field(default="tenant_project_alpha", min_length=1, max_length=128)
    user_id: str = Field(default="demo_user", min_length=1, max_length=128)
    expected_version: int = Field(..., ge=1)
    status: Literal["OPEN", "CLAIMED", "COMPLETED", "CANCELLED"]
    payload: Optional[Dict[str, Any]] = None


class SourceEntity(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    entity_type: str = Field(..., min_length=1, max_length=64)
    description: str = Field(default="", max_length=2000)
    relation: str = Field(default="mentions", max_length=64)


class SourceRelationship(BaseModel):
    source_name: str = Field(..., min_length=1, max_length=256)
    source_type: str = Field(..., min_length=1, max_length=64)
    target_name: str = Field(..., min_length=1, max_length=256)
    target_type: str = Field(..., min_length=1, max_length=64)
    relation: str = Field(..., min_length=1, max_length=64)


class KnowledgeSourceRequest(BaseModel):
    tenant_id: str = Field(default="tenant_project_alpha", min_length=1, max_length=128)
    user_id: str = Field(default="demo_user", min_length=1, max_length=128)
    source_type: Literal["DOCUMENT", "TICKET", "CHAT"]
    source_id: str = Field(..., min_length=1, max_length=256)
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1, max_length=30000)
    source_url: Optional[str] = Field(default=None, max_length=2000)
    modified_at: Optional[str] = None
    entities: List[SourceEntity] = Field(default_factory=list, max_length=100)
    relationships: List[SourceRelationship] = Field(default_factory=list, max_length=100)


class CompanyQuestionRequest(BaseModel):
    tenant_id: str = Field(default="tenant_project_alpha", min_length=1, max_length=128)
    question: str = Field(..., min_length=3, max_length=2000)
    limit: int = Field(default=8, ge=1, le=25)


memory_service = AgentMemoryService(db_client)


# ==============================================================================
# REST Endpoints: Health & Multi-Tenant Graph State
# ==============================================================================

@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    """
    Check backend status and verify live connection to FalkorDB on port 6379.
    """
    try:
        ping_res = db_client.query("RETURN 'pong' AS ping")
        falkordb_status = "connected" if ping_res.records else "error"
    except Exception as exc:
        falkordb_status = f"unreachable: {str(exc)}"

    return {
        "status": "healthy",
        "falkordb": falkordb_status,
        "host": db_client.host,
        "port": db_client.port,
        "tenants": [
            "tenant_project_alpha",
            "tenant_project_beta",
            "active_memory_default",
        ],
    }


@app.post("/api/graph/reset")
async def reset_graph_endpoint(request: Optional[ResetGraphRequest] = None) -> Dict[str, Any]:
    """
    Reset and re-seed the enterprise socio-technical graph for a specific tenant.
    Returns the fresh topology (nodes and links) for immediate UI rendering.
    """
    tenant_id = request.tenant_id if request else "tenant_project_alpha"
    seed_summary = seed_tenant_graph(db_client, tenant_id=tenant_id)
    topology = db_client.get_full_topology(tenant_id=tenant_id)

    return {
        "status": "SUCCESS",
        "tenant_id": tenant_id,
        "node_count": seed_summary.get("node_count", len(topology["nodes"])),
        "edge_count": seed_summary.get("edge_count", len(topology["links"])),
        "nodes": topology["nodes"],
        "links": topology["links"],
    }


@app.post("/api/graph/query")
async def execute_graph_query_endpoint(request: GraphQueryRequest) -> Dict[str, Any]:
    """
    Execute arbitrary OpenCypher query against FalkorDB for the specified tenant.
    Used by the Interactive Cypher Playground and real-time query debugging.
    """
    try:
        query_res = db_client.query(request.query, tenant_id=request.tenant_id)
        return {
            "status": "SUCCESS",
            "tenant_id": request.tenant_id,
            "query": request.query,
            "columns": query_res.columns,
            "records": query_res.records,
            "latency_ms": query_res.latency_ms,
            "count": len(query_res.records),
        }
    except Exception as exc:
        logger.warning("Error executing custom Cypher query: %s", exc)
        return {
            "status": "ERROR",
            "tenant_id": request.tenant_id,
            "query": request.query,
            "error": str(exc),
            "columns": [],
            "records": [],
            "latency_ms": 0.0,
            "count": 0,
        }


@app.get("/api/graph/state")
async def get_graph_state_endpoint(
    tenant_id: str = Query(default="tenant_project_alpha", description="Target tenant graph namespace"),
) -> Dict[str, Any]:
    """
    Retrieve current live graph topology and operational stats from FalkorDB.
    """
    topology = db_client.get_full_topology(tenant_id=tenant_id)

    # Compute operational statistics across the tenant graph
    active_res = db_client.query(
        """
        MATCH (e:APIEndpoint)
        WHERE coalesce(e.status, 'ACTIVE') = 'ACTIVE' AND coalesce(e.is_deprecated, false) = false
        RETURN count(e) AS cnt
        """,
        tenant_id=tenant_id,
    )
    deprecated_res = db_client.query(
        """
        MATCH (e:APIEndpoint)
        WHERE e.status = 'DEPRECATED' OR e.is_deprecated = true
        RETURN count(e) AS cnt
        """,
        tenant_id=tenant_id,
    )
    episodes_res = db_client.query(
        "MATCH (f:Failure) RETURN count(f) AS cnt",
        tenant_id=tenant_id,
    )

    active_cnt = active_res.records[0]["cnt"] if active_res.records else 0
    deprecated_cnt = deprecated_res.records[0]["cnt"] if deprecated_res.records else 0
    episodes_cnt = episodes_res.records[0]["cnt"] if episodes_res.records else 0

    return {
        "tenant_id": tenant_id,
        "nodes": topology["nodes"],
        "links": topology["links"],
        "stats": {
            "active_endpoints": active_cnt,
            "deprecated_endpoints": deprecated_cnt,
            "logged_episodes": episodes_cnt,
            "total_nodes": len(topology["nodes"]),
            "total_links": len(topology["links"]),
        },
    }


# ======================================================================
# REST Endpoints: Persistent Agent Memory + Company Brain
# ======================================================================

@app.post("/api/memory/records")
def write_memory_endpoint(request: MemoryWriteRequest) -> Dict[str, Any]:
    """Create or update one idempotent episodic, semantic, or procedural memory."""
    return memory_service.write_memory(**request.model_dump())


@app.get("/api/memory/records")
def recall_memory_endpoint(
    tenant_id: str = Query(default="tenant_project_alpha", min_length=1, max_length=128),
    user_id: str = Query(default="demo_user", min_length=1, max_length=128),
    memory_type: Optional[Literal["EPISODIC", "SEMANTIC", "PROCEDURAL"]] = None,
    session_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    """Recall recent memory scoped to both the selected graph and user key."""
    records = memory_service.recall(tenant_id=tenant_id, user_id=user_id,
                                    memory_type=memory_type, session_id=session_id,
                                    conversation_id=conversation_id, limit=limit)
    return {"tenant_id": tenant_id, "user_id": user_id, "records": records, "count": len(records)}


@app.get("/api/memory/conversations/{conversation_id}")
def get_conversation_history_endpoint(
    conversation_id: str,
    tenant_id: str = Query(default="tenant_project_alpha", min_length=1, max_length=128),
    user_id: str = Query(default="demo_user", min_length=1, max_length=128),
    limit: int = Query(default=100, ge=1, le=200),
) -> Dict[str, Any]:
    """Return durable conversation turns, ordered oldest to newest for replay."""
    records = memory_service.recall(tenant_id=tenant_id, user_id=user_id,
                                    memory_type="EPISODIC", conversation_id=conversation_id,
                                    limit=limit)
    records.sort(key=lambda record: record.get("created_at") or "")
    return {"tenant_id": tenant_id, "user_id": user_id,
            "conversation_id": conversation_id, "messages": records}


@app.post("/api/memory/handoffs")
def create_handoff_endpoint(request: HandoffCreateRequest) -> Dict[str, Any]:
    """Create an idempotent shared-state package for the next agent."""
    return memory_service.create_handoff(**request.model_dump())


@app.get("/api/memory/handoffs")
def list_handoffs_endpoint(
    tenant_id: str = Query(default="tenant_project_alpha", min_length=1, max_length=128),
    user_id: str = Query(default="demo_user", min_length=1, max_length=128),
    status: Optional[Literal["OPEN", "CLAIMED", "COMPLETED", "CANCELLED"]] = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> Dict[str, Any]:
    handoffs = memory_service.list_handoffs(tenant_id=tenant_id, user_id=user_id,
                                           status=status, limit=limit)
    return {"tenant_id": tenant_id, "user_id": user_id, "handoffs": handoffs}


@app.patch("/api/memory/handoffs/{handoff_id}")
def update_handoff_endpoint(handoff_id: str, request: HandoffUpdateRequest) -> Dict[str, Any]:
    """Change handoff status only when the caller's version is still current."""
    result = memory_service.update_handoff(tenant_id=request.tenant_id, user_id=request.user_id,
                                          handoff_id=handoff_id,
                                          expected_version=request.expected_version,
                                          status=request.status, payload=request.payload)
    if result is None:
        raise HTTPException(status_code=409,
                            detail="Handoff not found or version is stale; reload it before updating.")
    return result


@app.post("/api/company/sources")
def ingest_company_source_endpoint(request: KnowledgeSourceRequest) -> Dict[str, Any]:
    """Upsert a document, ticket, or chat excerpt with entity and relationship provenance."""
    return memory_service.ingest_source(
        tenant_id=request.tenant_id, user_id=request.user_id,
        source_type=request.source_type, source_id=request.source_id,
        title=request.title, content=request.content, source_url=request.source_url,
        modified_at=request.modified_at,
        entities=[entity.model_dump() for entity in request.entities],
        relationships=[link.model_dump() for link in request.relationships],
    )


@app.post("/api/company/ask")
def ask_company_endpoint(request: CompanyQuestionRequest) -> Dict[str, Any]:
    """Answer from tenant graph evidence and return its connected source paths."""
    return memory_service.ask_company(tenant_id=request.tenant_id,
                                      question=request.question, limit=request.limit)


# ==============================================================================
# SSE Endpoints: Real-Time Multi-Agent Streaming
# ==============================================================================

async def _stream_scenario_runner(runner_fn: Callable[..., Any], tenant_id: str,
                                  user_id: str = "demo_user",
                                  runner_kwargs: Optional[Dict[str, Any]] = None) -> EventSourceResponse:
    """
    Execute a synchronous LangGraph swarm runner in a background thread while
    streaming each emitted SSE event in real-time over HTTP EventSource.
    """
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def event_listener(event: Any) -> None:
        if getattr(event, "event_type", None) == "SESSION_COMPLETE":
            try:
                memory_service.write_memory(
                    tenant_id=tenant_id, user_id=user_id, memory_type="EPISODIC",
                    content=event.final_summary, summary=event.final_summary[:500],
                    agent_id=runner_fn.__name__, session_id=event.session_id,
                    idempotency_key=f"run:{event.session_id}",
                    metadata={"status": str(event.status), "scenario": runner_fn.__name__},
                )
            except Exception:
                # A memory persistence hiccup must not interrupt the live run stream.
                logger.exception("Could not persist completed run memory for %s", event.session_id)
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def worker() -> None:
        try:
            await asyncio.to_thread(
                runner_fn,
                tenant_id=tenant_id,
                listener=event_listener,
                client=db_client,
                **(runner_kwargs or {}),
            )
        except Exception as exc:
            logger.exception("Error executing swarm runner background task: %s", exc)
            fallback_term = SessionCompleteEvent(
                session_id=f"sess_err_{uuid.uuid4().hex[:8]}",
                status=SessionStatus.FAILED,
                final_summary=f"Swarm runner background task failed: {str(exc)}",
            )
            event_listener(fallback_term)
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    worker_task = asyncio.create_task(worker())

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                payload_json = event.model_dump_json()
                yield ServerSentEvent(data=payload_json, event=event.event_type)
                if getattr(event, "event_type", None) == "SESSION_COMPLETE":
                    break
        finally:
            if not worker_task.done():
                worker_task.cancel()

    return EventSourceResponse(event_generator())


@app.get("/api/stream/scenario-a/session-1")
async def stream_scenario_a_session_1(
    tenant_id: str = Query(default="tenant_project_alpha", description="Target tenant graph namespace"),
    user_id: str = Query(default="demo_user", min_length=1, max_length=128),
) -> EventSourceResponse:
    """
    Stream Scenario A Session 1: IngestionSubagent experiences HTTP 410,
    executes atomic Graph Stigmergy, and heals execution route to /v3/oauth/token.
    """
    return await _stream_scenario_runner(run_scenario_a_session_1, tenant_id=tenant_id, user_id=user_id)


@app.get("/api/stream/scenario-a/session-2")
async def stream_scenario_a_session_2(
    tenant_id: str = Query(default="tenant_project_alpha", description="Target tenant graph namespace"),
    user_id: str = Query(default="demo_user", min_length=1, max_length=128),
) -> EventSourceResponse:
    """
    Stream Scenario A Session 2: BillingSubagent in a brand-new session inherits
    the failure provenance from Session 1 and zero-shots /v3/oauth/token.
    """
    return await _stream_scenario_runner(run_scenario_a_session_2, tenant_id=tenant_id, user_id=user_id)


@app.get("/api/stream/scenario-b/guardrail")
async def stream_scenario_b_guardrail(
    tenant_id: str = Query(default="tenant_project_alpha", description="Target tenant graph namespace"),
    user_id: str = Query(default="demo_user", min_length=1, max_length=128),
) -> EventSourceResponse:
    """
    Stream Scenario B: ArchitectAgent inspects PaymentRetryWorker, triggers
    the 3-hop constraint guardrail, and halts destructive batch refactor.
    """
    return await _stream_scenario_runner(run_scenario_b_refactor_guardrail, tenant_id=tenant_id, user_id=user_id)


@app.get("/api/stream/agent-handoff")
async def stream_agent_handoff(
    tenant_id: str = Query(default="tenant_project_alpha", min_length=1, max_length=128),
    user_id: str = Query(default="demo_user", min_length=1, max_length=128),
    question: str = Query(..., min_length=3, max_length=2000),
) -> EventSourceResponse:
    """Stream ContextAgent -> durable handoff -> ResearchAgent resume as one LangGraph run."""
    return await _stream_scenario_runner(
        run_agent_handoff_workflow, tenant_id=tenant_id, user_id=user_id,
        runner_kwargs={"user_id": user_id, "question": question},
    )
