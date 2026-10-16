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
from pathlib import Path
import sys
from typing import Any, Callable, Dict, Optional

# Ensure backend root directory is in sys.path
backend_dir = str(Path(__file__).resolve().parents[1])
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logger = logging.getLogger(__name__)
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

import uuid
from app.agents.swarm import (
    run_scenario_a_session_1,
    run_scenario_a_session_2,
    run_scenario_b_refactor_guardrail,
)
from app.db.graph_client import FalkorDBClient
from app.db.seed_enterprise_graph import seed_tenant_graph
from app.models.events import SessionCompleteEvent, SessionStatus

# Initialize FastAPI application
app = FastAPI(
    title="Active Engineering Memory Layer API",
    description="Socio-technical knowledge graph memory, FastMCP tools, and LangGraph multi-agent swarm SSE stream.",
    version="1.0.0",
)

# Enable CORS for Next.js frontend on port 3001
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
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


# ==============================================================================
# SSE Endpoints: Real-Time Multi-Agent Streaming
# ==============================================================================

async def _stream_scenario_runner(runner_fn: Callable[..., Any], tenant_id: str) -> EventSourceResponse:
    """
    Execute a synchronous LangGraph swarm runner in a background thread while
    streaming each emitted SSE event in real-time over HTTP EventSource.
    """
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def event_listener(event: Any) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def worker() -> None:
        try:
            await asyncio.to_thread(
                runner_fn,
                tenant_id=tenant_id,
                listener=event_listener,
                client=db_client,
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
) -> EventSourceResponse:
    """
    Stream Scenario A Session 1: IngestionSubagent experiences HTTP 410,
    executes atomic Graph Stigmergy, and heals execution route to /v3/oauth/token.
    """
    return await _stream_scenario_runner(run_scenario_a_session_1, tenant_id=tenant_id)


@app.get("/api/stream/scenario-a/session-2")
async def stream_scenario_a_session_2(
    tenant_id: str = Query(default="tenant_project_alpha", description="Target tenant graph namespace"),
) -> EventSourceResponse:
    """
    Stream Scenario A Session 2: BillingSubagent in a brand-new session inherits
    the failure provenance from Session 1 and zero-shots /v3/oauth/token.
    """
    return await _stream_scenario_runner(run_scenario_a_session_2, tenant_id=tenant_id)


@app.get("/api/stream/scenario-b/guardrail")
async def stream_scenario_b_guardrail(
    tenant_id: str = Query(default="tenant_project_alpha", description="Target tenant graph namespace"),
) -> EventSourceResponse:
    """
    Stream Scenario B: ArchitectAgent inspects PaymentRetryWorker, triggers
    the 3-hop constraint guardrail, and halts destructive batch refactor.
    """
    return await _stream_scenario_runner(run_scenario_b_refactor_guardrail, tenant_id=tenant_id)
